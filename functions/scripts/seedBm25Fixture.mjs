import {createReadStream} from "node:fs";
import {readFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {createInterface} from "node:readline";
import {fileURLToPath} from "node:url";
import {deleteApp, initializeApp} from "firebase-admin/app";
import {FieldPath, Timestamp, getFirestore} from "firebase-admin/firestore";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../..");
const frontendEnvironmentPath = join(repositoryRoot, ".env.local");
const fixtureKind = process.argv[2] ?? "bm25";
const fixtureConfigurations = {
  bm25: {
    displayName: "Projector Calibration",
    expectedCount: 24,
    fileName: "projectorCalibrationConversation.json",
    commandName: "seed:bm25",
  },
  recency: {
    displayName: "Aurora Venue Recency Comparison",
    expectedCount: 24,
    fileName: "recencyComparisonConversation.json",
    commandName: "seed:recency",
  },
  mmr: {
    displayName: "Orion Launch MMR Comparison",
    expectedCount: 36,
    fileName: "mmrLaunchConversation.json",
    commandName: "seed:mmr",
  },
};
const fixtureConfiguration = fixtureConfigurations[fixtureKind];

if (!fixtureConfiguration) {
  throw new Error("Fixture must be bm25, recency, or mmr.");
}

const fixturePath = join(
  repositoryRoot,
  "functions/test/fixtures",
  fixtureConfiguration.fileName,
);
const expectedFrontendKeys = new Set([
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_USE_FIRESTORE_EMULATOR",
  "VITE_FIRESTORE_EMULATOR_HOST",
  "VITE_FIRESTORE_EMULATOR_PORT",
]);
const allowedLoopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);
const fixtureStartMillis = Date.UTC(2026, 0, 1, 0, 0, 0);
const fixtureIntervalMillis = 60_000;
const fixedCollectionPath = "rooms/main/messages";

async function main() {
  rejectServiceAccountConfiguration();

  const emulator = parseEmulatorHost(process.env.FIRESTORE_EMULATOR_HOST);
  const frontendEnvironment = await readFrontendEnvironment();
  const projectId = requireFrontendValue(
    frontendEnvironment,
    "VITE_FIREBASE_PROJECT_ID",
  );

  validateFrontendEmulatorConfiguration(frontendEnvironment, emulator);
  validateProcessProjectConfiguration(projectId);
  await verifyRunningEmulator(projectId, emulator);

  const fixture = await readFixture();
  const app = initializeApp(
    {projectId},
    `${fixtureKind}-fixture-seeder`,
  );

  try {
    const firestore = getFirestore(app);
    const messages = firestore.collection(fixedCollectionPath);
    const expectedMessages = buildExpectedMessages(fixture);
    const existingSnapshot = await messages.get();
    const existingById = new Map(
      existingSnapshot.docs.map((document) => [document.id, document]),
    );
    const expectedIds = new Set(expectedMessages.map(({id}) => id));
    const unrelatedCount = existingSnapshot.docs.filter(
      ({id}) => !expectedIds.has(id),
    ).length;

    if (unrelatedCount > 0) {
      throw new Error(
        `${unrelatedCount} unrelated message(s) already exist in ` +
        `${fixedCollectionPath}. No data was changed. Restart the local ` +
        "emulators without imported data, then run the seed command again.",
      );
    }

    const conflictingCount = expectedMessages.filter(({id, data}) => {
      const existing = existingById.get(id);
      return existing !== undefined && !matchesExpectedData(existing.data(), data);
    }).length;

    if (conflictingCount > 0) {
      throw new Error(
        `${conflictingCount} fixture document(s) contain unexpected data in ` +
        `${fixedCollectionPath}. No data was changed. Restart the local ` +
        "emulators without imported data, then run the seed command again.",
      );
    }

    const missingMessages = expectedMessages.filter(
      ({id}) => !existingById.has(id),
    );

    if (missingMessages.length > 0) {
      const batch = firestore.batch();

      for (const {id, data} of missingMessages) {
        batch.create(messages.doc(id), data);
      }

      await batch.commit();
    }

    const verificationSnapshot = await messages
      .orderBy("createdAt", "asc")
      .orderBy(FieldPath.documentId(), "asc")
      .get();
    verifySeededConversation(verificationSnapshot.docs, expectedMessages);

    console.info(
      `Seeded ${fixtureConfiguration.displayName} fixture: ` +
      `${expectedMessages.length} messages present ` +
      `(created ${missingMessages.length}, updated 0).`,
    );
  } finally {
    await deleteApp(app);
  }
}

function rejectServiceAccountConfiguration() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS must be unset. This script never uses " +
      "production service-account credentials.",
    );
  }
}

function parseEmulatorHost(rawHost) {
  if (!rawHost) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST is required. Example: " +
      "FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run " +
      fixtureConfiguration.commandName,
    );
  }

  let url;

  try {
    url = new URL(`http://${rawHost}`);
  } catch {
    throw new Error("FIRESTORE_EMULATOR_HOST must contain a host and port.");
  }

  const port = Number(url.port);

  if (
    !allowedLoopbackHosts.has(url.hostname) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65_535 ||
    url.username ||
    url.password ||
    url.pathname !== "/"
  ) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST must point to localhost, 127.0.0.1, or ::1 " +
      "with an explicit port.",
    );
  }

  return {hostname: url.hostname, port};
}

async function readFrontendEnvironment() {
  const values = new Map();
  let input;

  try {
    input = createReadStream(frontendEnvironmentPath, {encoding: "utf8"});
    await new Promise((resolvePromise, rejectPromise) => {
      input.once("open", resolvePromise);
      input.once("error", rejectPromise);
    });
  } catch {
    throw new Error(
      ".env.local is required so the seeder can verify the frontend project " +
      "and Firestore Emulator configuration.",
    );
  }

  const lines = createInterface({input, crlfDelay: Infinity});

  for await (const line of lines) {
    const separatorIndex = line.indexOf("=");

    if (separatorIndex < 1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();

    if (expectedFrontendKeys.has(key)) {
      values.set(key, line.slice(separatorIndex + 1).trim());
    }
  }

  return values;
}

function requireFrontendValue(environment, key) {
  const value = environment.get(key);

  if (!value) {
    throw new Error(`${key} must be configured in .env.local.`);
  }

  return value;
}

function validateFrontendEmulatorConfiguration(environment, emulator) {
  if (environment.get("VITE_USE_FIRESTORE_EMULATOR") !== "true") {
    throw new Error(
      "VITE_USE_FIRESTORE_EMULATOR must be true in .env.local.",
    );
  }

  const frontendHost = requireFrontendValue(
    environment,
    "VITE_FIRESTORE_EMULATOR_HOST",
  );
  const frontendPort = Number(requireFrontendValue(
    environment,
    "VITE_FIRESTORE_EMULATOR_PORT",
  ));

  if (
    !allowedLoopbackHosts.has(frontendHost) ||
    frontendPort !== emulator.port
  ) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST must match the loopback Firestore Emulator " +
      "configuration in .env.local.",
    );
  }
}

function validateProcessProjectConfiguration(projectId) {
  const configuredProjectIds = [
    process.env.GCLOUD_PROJECT,
    process.env.GOOGLE_CLOUD_PROJECT,
  ].filter(Boolean);

  if (configuredProjectIds.some((value) => value !== projectId)) {
    throw new Error(
      "The process project ID does not match VITE_FIREBASE_PROJECT_ID in " +
      ".env.local.",
    );
  }

  if (process.env.FIREBASE_CONFIG) {
    let firebaseConfig;

    try {
      firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);
    } catch {
      throw new Error("FIREBASE_CONFIG is not valid JSON.");
    }

    if (firebaseConfig.projectId && firebaseConfig.projectId !== projectId) {
      throw new Error(
        "FIREBASE_CONFIG does not match VITE_FIREBASE_PROJECT_ID in .env.local.",
      );
    }
  }
}

async function verifyRunningEmulator(projectId, emulator) {
  const locatorPath = join(tmpdir(), `hub-${projectId}.json`);
  let locator;

  try {
    locator = JSON.parse(await readFile(locatorPath, "utf8"));
  } catch {
    throw new Error(
      `No running Firebase Emulator Suite was found for project ${projectId}. ` +
      `Start it with: firebase emulators:start --project ${projectId}`,
    );
  }

  for (const origin of locator.origins ?? []) {
    let originUrl;

    try {
      originUrl = new URL(origin);
    } catch {
      continue;
    }

    if (!allowedLoopbackHosts.has(originUrl.hostname)) {
      continue;
    }

    try {
      const response = await fetch(`${origin}/emulators`, {
        signal: AbortSignal.timeout(2_000),
      });

      if (!response.ok) {
        continue;
      }

      const runningEmulators = await response.json();
      const runningFirestore = runningEmulators.firestore;
      const listeningPorts = (runningFirestore?.listen ?? [])
        .map(({port}) => Number(port));

      if (
        runningFirestore &&
        (Number(runningFirestore.port) === emulator.port ||
          listeningPorts.includes(emulator.port))
      ) {
        return;
      }
    } catch {
      // Try another loopback origin from the same project locator.
    }
  }

  throw new Error(
    `The Firestore Emulator for project ${projectId} is unavailable at ` +
    `${process.env.FIRESTORE_EMULATOR_HOST}. No data was changed.`,
  );
}

async function readFixture() {
  let parsed;

  try {
    parsed = JSON.parse(await readFile(fixturePath, "utf8"));
  } catch {
    throw new Error(
      `The ${fixtureConfiguration.displayName} fixture could not be loaded.`,
    );
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length !== fixtureConfiguration.expectedCount ||
    parsed.some(({id, text}) => !id || typeof text !== "string") ||
    new Set(parsed.map(({id}) => id)).size !== parsed.length ||
    (fixtureKind !== "bm25" && parsed.some(({senderId, createdAt}) => (
      !["alice", "bob"].includes(senderId) ||
      typeof createdAt !== "string" ||
      !Number.isFinite(Date.parse(createdAt))
    )))
  ) {
    throw new Error(
      `The ${fixtureConfiguration.displayName} fixture must contain ` +
      `${fixtureConfiguration.expectedCount} unique valid messages.`,
    );
  }

  return parsed;
}

function buildExpectedMessages(fixture) {
  return fixture.map(({id, text, senderId, createdAt}, index) => {
    const resolvedSenderId = fixtureKind !== "bm25" ?
      senderId : (index % 2 === 0 ? "alice" : "bob");
    const createdAtTimestamp = fixtureKind !== "bm25" ?
      Timestamp.fromMillis(Date.parse(createdAt)) :
      Timestamp.fromMillis(
        fixtureStartMillis + index * fixtureIntervalMillis,
      );

    return {
      id,
      data: {
        senderId: resolvedSenderId,
        senderName: resolvedSenderId === "alice" ? "Alice" : "Bob",
        text,
        createdAt: createdAtTimestamp,
      },
    };
  });
}

function matchesExpectedData(actual, expected) {
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();

  return (
    JSON.stringify(actualKeys) === JSON.stringify(expectedKeys) &&
    actual.senderId === expected.senderId &&
    actual.senderName === expected.senderName &&
    actual.text === expected.text &&
    actual.createdAt instanceof Timestamp &&
    actual.createdAt.isEqual(expected.createdAt)
  );
}

function verifySeededConversation(documents, expectedMessages) {
  if (documents.length !== expectedMessages.length) {
    throw new Error(
      "Verification failed: expected " +
      `${fixtureConfiguration.expectedCount} messages, ` +
      `found ${documents.length}.`,
    );
  }

  for (let index = 0; index < expectedMessages.length; index += 1) {
    const document = documents[index];
    const expected = expectedMessages[index];

    if (
      document.id !== expected.id ||
      !matchesExpectedData(document.data(), expected.data)
    ) {
      throw new Error(
        `Verification failed at fictional message ${index + 1}.`,
      );
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error.";
  console.error(`${fixtureConfiguration.displayName} fixture seed failed: ` +
    message);
  process.exitCode = 1;
});
