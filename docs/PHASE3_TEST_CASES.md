# Phase 3 Test Cases

This document is used to record Phase 3 validation evidence for the AI-assisted chat proof of concept.

Manual observations and live AI-quality results were recorded after execution. No unexecuted result is included in this document.

## 1. Automated Test Summary

| Category | Passed | Failed | Notes |
|---|---:|---:|---|
| Frontend Unit Tests | 16 | 0 | Pure validation and frontend AI-result validation tests. |
| Functions Unit Tests | 23 | 0 | Backend callable input, AI-result validation, and mock-provider tests. |
| Firestore Security Rules Tests | 26 | 0 | Emulator-backed tests against the repository's actual `firestore.rules`. |
| Integration Tests | 6 | 0 | Local emulator tests for Auth, Firestore listener behavior, and callable boundaries. |
| Total | 71 | 0 | All automated Phase 3 validation currently passes. |

Notable finding: U+3000-only whitespace messages were initially accepted by the previous Firestore Security Rule. The rule was tightened to reject that input, and the complete Firestore Security Rules suite then passed.

## 2. Manual UI / Exploratory Test Matrix

| Test ID | Category | Feature | Preconditions | Test Steps | Expected Result | Observed Result | Status | Evidence / Notes |
|---|---|---|---|---|---|---|---|---|
| MAN-001 | Startup | Application startup / anonymous authentication | Local app is running with Firebase services configured for the intended validation environment. | Open the application in a browser. Wait for initial loading to complete. | The app loads successfully, signs in anonymously, and displays the main chat UI without authentication errors. | Application loaded successfully in Chrome with no startup or authentication errors. | Pass |  |
| MAN-002 | Identity | Alice/Bob identity switching | App is open and authenticated. | Switch from Alice to Bob, then back to Alice. | The selected display user changes clearly. Existing messages remain visible. No message is sent by switching identity. | Alice/Bob display identity switching worked correctly. | Pass |  |
| MAN-003 | Drafts | Separate Alice/Bob drafts | App is open and authenticated. | Type an unsent Alice draft. Switch to Bob and type a different Bob draft. Switch between Alice and Bob. | Alice and Bob drafts are preserved separately and restored with the selected identity. | Alice and Bob drafts were preserved separately and restored correctly when switching identities. | Pass |  |
| MAN-004 | Messaging | Valid message sending | App is open and authenticated. Alice or Bob is selected. | Type a valid non-empty message and click Send. | The message is stored, appears in chat, the draft clears for that sender, and the UI exits the sending state. | Valid messages were sent successfully and the Sending state returned to normal. | Pass |  |
| MAN-005 | Messaging | Repeated message sending | App is open and authenticated. | Send one valid message. Confirm Sending stops. Immediately type and send a second valid message. | Both messages appear. Sending state resets after each send. The second send is not blocked. | Multiple messages could be sent consecutively. Sending state reset after each send and the second send was not blocked. | Pass | Regression check for stuck Sending state. |
| MAN-006 | Validation | Whitespace-only input rejection | App is open and authenticated. | Try to send inputs containing only spaces, only tabs/newlines, and only U+3000 full-width spaces. | Whitespace-only messages are rejected by the UI and are not stored as chat messages. | Whitespace-only input could not be sent and was not stored in Firestore. Spaces, tabs/newlines, and U+3000 full-width spaces were manually checked. | Pass |  |
| MAN-007 | Realtime | Realtime update between two browser clients | Browser A and Browser B are open against the same Firebase Emulator/project or validation environment. | Send a message from Browser B. Observe Browser A. | Browser A receives and displays the new message through the realtime listener without refresh. | A message sent from Browser B appeared in Browser A in real time without refresh. | Pass |  |
| MAN-008 | Display | Chronological message display | App has several messages with different creation times. | Send or seed several messages in known order. Refresh or reopen the app. | Messages are displayed from oldest to newest. New realtime messages appear in chronological order. | Messages appeared in chronological order and remained correctly ordered after page reload. | Pass |  |
| MAN-009 | AI | Analyze Conversation successful flow | App is authenticated, live OpenAI configuration is intentionally enabled, and fictional messages are present. | Click Analyze Conversation for the selected display user. Wait for completion. | The UI shows a summary, important information, and one suggested reply. Loading state clears. No chat message is sent by analysis. | Analyze Conversation successfully displayed Summary, Important Information, and Suggested Reply when a reply was appropriate. Suggested Reply was empty when the selected identity had no outstanding message requiring a reply or when the conversation was considered complete. This is intended application behavior. Loading state completed normally and analysis did not automatically send a chat message. | Pass |  |
| MAN-010 | AI | Separate Alice/Bob AI analysis state | App has generated an Alice analysis. No conversation changes occur. | Switch to Bob, then switch back to Alice. Optionally generate a Bob analysis and switch again. | Alice and Bob AI analysis states remain separate. Alice's result remains available when returning to Alice if the conversation did not change. | Alice and Bob analysis results remained separate and persisted across identity switching when the conversation did not change. | Pass |  |
| MAN-011 | AI invalidation | Same-client conversation change invalidates both AI analyses | Alice and Bob analyses are both visible in the current browser. | Send a new valid message from the same browser. | Both Alice and Bob AI analyses are cleared after the conversation changes. Sending state still returns to normal. | Sending a new message from the same browser cleared both Alice and Bob analysis results. Sending state also returned to normal. | Pass |  |
| MAN-012 | AI invalidation | External-client conversation change invalidates stale AI analysis | Browser A has an AI analysis result. Browser B is open against the same room. | Send a new valid message from Browser B. Observe Browser A. | Browser A receives the new message and clears stale AI analysis results without refresh. | A message sent from Browser B appeared in Browser A in real time and Browser A's stale analysis result was cleared. | Pass |  |
| MAN-013 | Drafts and AI invalidation | External conversation change preserves unsent draft | Browser A has an unsent draft and an AI analysis result. Browser B is open against the same room. | Send a new valid message from Browser B. Observe Browser A. | Browser A invalidates AI analysis but keeps the current unsent draft unchanged. | External conversation change cleared the stale AI result but preserved the current unsent draft. | Pass |  |
| MAN-014 | Human control | Use Reply inserts suggestion into editable draft only | AI analysis result with suggested reply is visible. | Click Use Reply. | The suggested reply is inserted into the selected user's draft. It is not sent automatically. | Use Reply inserted the Suggested Reply into the selected user's editable draft and did not send it. | Pass |  |
| MAN-015 | Human control | Suggested reply can be edited before sending | A suggested reply has been inserted into the draft. | Edit the inserted draft text, then click Send. | The edited text, not necessarily the original suggestion, is sent as the chat message. | The inserted Suggested Reply could be edited before sending. | Pass |  |
| MAN-016 | Human control | AI-generated reply is never automatically sent | AI analysis is run and a suggested reply is displayed. | Observe the chat after analysis. Click Use Reply but do not click Send. | No AI-generated message appears in chat unless the user explicitly clicks Send. | AI-generated Suggested Reply was never automatically sent. A message was sent only after the user explicitly clicked Send. | Pass |  |

Manual summary: 16 passed, 0 partial, 0 failed.

## 3. Live OpenAI Quality Evaluation

Rating values: `Good`, `Acceptable`, or `Poor`. Status values may use `Pass`, `Partial`, or `Fail` after manual evaluation. Do not require exact wording from the AI; evaluate semantic quality.

For non-empty scenarios, evaluate summary correctness, important-information precision, suggested-reply relevance, correct `replyAs` perspective, and absence of unsupported facts.

### AI-001 Simple Question Requiring Reply

**Conversation**

| Sender | Message |
|---|---|
| Alice | Hi Bob, did you finish reviewing the draft poster? |
| Bob | Not yet, but I can look at it after lunch. |
| Alice | Great, could you tell me if the methods section is clear? |

**replyAs:** Bob

**Expected qualitative behavior:** The result should summarize that Alice wants Bob to review the poster methods section. Important information should mention the poster draft and methods section. The suggested reply should be from Bob and should acknowledge that he will review it after lunch or ask a relevant follow-up.

**Actual Summary:** Alice asks Bob to review the draft poster, particularly whether the methods section is clear. Bob said he would look at it after lunch but has not yet reviewed it.

**Actual Important Information:**

- Bob has not finished reviewing the draft poster.
- Bob said he could review it after lunch.
- Alice specifically asks Bob to assess whether the methods section is clear.

**Actual Suggested Reply:** Sure, I'll review the methods section after lunch and let you know whether it's clear.

**Summary Quality:** Good

**Important Information Quality:** Good

**Suggested Reply Quality:** Good

**Hallucination Observed:** No

**Status:** Pass

**Notes:** None.

### AI-002 Scheduling Conversation With Date/Time

**Conversation**

| Sender | Message |
|---|---|
| Bob | Alice, are you free for a project check-in on Thursday at 3 PM? |
| Alice | Thursday at 3 PM works for me. |
| Bob | Perfect, let's meet in the library study room. |

**replyAs:** Alice

**Expected qualitative behavior:** The result should capture the agreed meeting time and place. The suggested reply should be from Alice and should confirm or acknowledge the library study room without inventing extra scheduling details.

**Actual Summary:** Bob and Alice agreed to meet for a project check-in on Thursday at 3 PM in the library study room.

**Actual Important Information:**

- Project check-in scheduled for Thursday at 3 PM.
- Meeting location: library study room.

**Actual Suggested Reply:** (empty)

**Summary Quality:** Good

**Important Information Quality:** Good

**Suggested Reply Quality:** Good

**Hallucination Observed:** No

**Status:** Pass

**Notes:** The conversation was already complete, so no additional reply was required.

### AI-003 Multiple Important Facts

**Conversation**

| Sender | Message |
|---|---|
| Alice | The prototype demo is on May 12. |
| Bob | I will bring the laptop and HDMI adapter. |
| Alice | I will prepare the slides and submit the abstract by Friday. |
| Bob | We should also test the Wi-Fi in the classroom before the demo. |

**replyAs:** Alice

**Expected qualitative behavior:** The result should identify the demo date, Bob's equipment responsibility, Alice's slides and abstract task, and the Wi-Fi check. The suggested reply should be from Alice and should address the next coordination step without adding unsupported facts.

**Actual Summary:** Alice and Bob are coordinating a prototype demo scheduled for May 12. Alice will prepare the slides and submit the abstract by Friday, while Bob will bring the laptop and HDMI adapter. Bob also suggested testing the classroom Wi-Fi before the demo.

**Actual Important Information:**

- The prototype demo is scheduled for May 12.
- Bob will bring the laptop and HDMI adapter.
- Alice will prepare the slides and submit the abstract by Friday.
- The classroom Wi-Fi should be tested before the demo.

**Actual Suggested Reply:** I'll make sure the slides and abstract are ready, and we can test the classroom Wi-Fi before May 12.

**Summary Quality:** Good

**Important Information Quality:** Good

**Suggested Reply Quality:** Good

**Hallucination Observed:** No

**Status:** Pass

**Notes:** None.

### AI-004 Action Item / Task Assignment

**Conversation**

| Sender | Message |
|---|---|
| Bob | Alice, could you upload the cleaned dataset before tomorrow's meeting? |
| Alice | Yes, I can do that tonight. |
| Bob | Thanks. Please put it in the shared project folder. |

**replyAs:** Alice

**Expected qualitative behavior:** The result should identify Alice's task to upload the cleaned dataset tonight to the shared project folder. The suggested reply should be from Alice and should confirm the action or note completion timing.

**Actual Summary:** Bob asked Alice to upload the cleaned dataset to the shared project folder before tomorrow's meeting. Alice agreed to do so tonight.

**Actual Important Information:**

- Task: Alice is to upload the cleaned dataset.
- Deadline: Before tomorrow's meeting; Alice said she would do it tonight.
- Location: The shared project folder.

**Actual Suggested Reply:** Sure, I'll upload the cleaned dataset to the shared project folder tonight.

**Summary Quality:** Good

**Important Information Quality:** Good

**Suggested Reply Quality:** Good

**Hallucination Observed:** No

**Status:** Pass

**Notes:** None.

### AI-005 Selected replyAs Still Owes A Reply

**Conversation**

| Sender | Message |
|---|---|
| Alice | Bob, can you choose between the blue and green chart style? |
| Alice | I need your choice before I finalize the slides. |

**replyAs:** Bob

**Expected qualitative behavior:** The result should recognize that Bob has not answered yet. The suggested reply should be from Bob and should provide a choice or ask a concise clarifying question, not speak as Alice.

**Actual Summary:** Alice is asking Bob to choose between the blue and green chart styles before she finalizes the slides.

**Actual Important Information:**

- Bob needs to choose either the blue or green chart style.
- Alice needs Bob's choice before finalizing the slides.

**Actual Suggested Reply:** I choose the blue chart style.

**Summary Quality:** Good

**Important Information Quality:** Good

**Suggested Reply Quality:** Good

**Hallucination Observed:** No

**Status:** Pass

**Notes:** None.

### AI-006 Selected replyAs Already Replied

**Conversation**

| Sender | Message |
|---|---|
| Bob | Alice, can you send me the bibliography file? |
| Alice | I just sent it to your email. |
| Bob | Got it, thank you. |

**replyAs:** Alice

**Expected qualitative behavior:** The result should recognize that Alice has already replied and Bob acknowledged it. The suggested reply should avoid creating an unnecessary self-reply; a brief acknowledgement may be acceptable if the app always returns one suggestion.

**Actual Summary:** Alice told Bob that she sent the bibliography file to his email, and Bob confirmed receipt and thanked her.

**Actual Important Information:**

- The bibliography file was sent to Bob's email.
- Bob confirmed that he received it.

**Actual Suggested Reply:** (empty)

**Summary Quality:** Good

**Important Information Quality:** Good

**Suggested Reply Quality:** Good

**Hallucination Observed:** No

**Status:** Pass

**Notes:** The selected identity had already replied and the exchange was complete.

### AI-007 Conversation With No Clear Outstanding Reply

**Conversation**

| Sender | Message |
|---|---|
| Alice | The lab report was submitted this morning. |
| Bob | Nice, thanks for handling it. |
| Alice | No problem. |

**replyAs:** Bob

**Expected qualitative behavior:** The result should summarize the completed exchange and avoid implying an unresolved task. The suggested reply should be optional or low-pressure, such as a brief acknowledgement, without inventing new work.

**Actual Summary:** Alice submitted the lab report this morning, and Bob thanked her. Alice acknowledged his thanks.

**Actual Important Information:**

- The lab report was submitted this morning.

**Actual Suggested Reply:** (empty)

**Summary Quality:** Good

**Important Information Quality:** Good

**Suggested Reply Quality:** Good

**Hallucination Observed:** No

**Status:** Pass

**Notes:** No outstanding reply was necessary.

### AI-008 Empty Conversation

**Conversation**

No messages in the room.

**replyAs:** Alice

**Expected qualitative behavior:** The result should use the application's empty-conversation behavior and should not invent conversation content. The summary should indicate there is no conversation to summarize, important information should be empty, and the suggested reply should be empty or otherwise clearly not based on invented context.

**Actual Summary:** No conversation to summarize.

**Actual Important Information:** No important information identified.

**Actual Suggested Reply:** (empty)

**Summary Quality:** Good

**Important Information Quality:** Good

**Suggested Reply Quality:** Good

**Hallucination Observed:** No

**Status:** Pass

**Notes:** None.

AI evaluation summary: 8 passed, 0 partial, 0 failed. No unsupported factual hallucinations were observed in these eight scenarios.

## 4. Performance And Reliability Observations

Keep these measurements practical. Use browser developer tools, visible UI behavior, and a stopwatch where appropriate. Detailed CPU/memory profiling is optional for this small academic proof of concept unless a meaningful issue is observed.

| Measurement ID | Scenario | Measurement Method | Runs | Observed Values | Summary | Notes |
|---|---|---|---:|---|---|---|
| PERF-001 | Message send to UI appearance | Start timing when Send is clicked. Stop when the message appears in the chat UI and Sending state clears. | 5 | 0.38 s; 0.35 s; 0.41 s; 0.39 s; 0.51 s | Average approximately 0.41 s. Range 0.35-0.51 s. All five sends completed successfully. | No stuck Sending state or visible failure occurred. |
| PERF-002 | Realtime message propagation between two browser windows | Start timing when Browser B sends a message. Stop when Browser A displays it. | 5 | 0.67 s; 0.71 s; 0.65 s; 0.80 s; 0.77 s | Average approximately 0.72 s. Range 0.65-0.80 s. All five realtime updates appeared successfully without refresh. |  |
| PERF-003 | Analyze Conversation end-to-end latency with live OpenAI | Start timing when Analyze Conversation is clicked. Stop when summary, important information, and suggested reply are visible. | 5 | 5.65 s; 3.08 s; 3.15 s; 3.00 s; 3.88 s | Average approximately 3.75 s. Range 3.00-5.65 s. All five Analyze Conversation requests completed successfully. | Latency varied between runs, but no request failed or became stuck. |
| PERF-004 | Repeated Analyze Conversation requests | Run Analyze Conversation repeatedly on a stable fictional conversation. Record success/failure and approximate latency. | 5 | 4.65 s; 6.28 s; 3.25 s; 3.20 s; 3.16 s | Average approximately 4.11 s. Range 3.16-6.28 s. All five repeated requests completed successfully. | All responses retained the required Summary, Important Information, and Suggested Reply structure. One minor semantic variation was observed: "What time works best for you to meet at the library?" This was contextually related but less appropriate than proposing a time because Alice had already asked Bob what time to meet. The other runs proposed a concrete time such as "How about 3:00 PM?" No structural failures, stuck loading states, or callable errors were observed. |

## 5. Validation Summary

| Summary Item | Result |
|---|---|
| Automated tests passed / failed | 71 passed, 0 failed. |
| Manual tests passed / partial / failed | 16 passed, 0 partial, 0 failed. |
| AI-quality evaluation summary | 8 passed, 0 partial, 0 failed. No unsupported factual hallucinations were observed in the eight evaluated scenarios. |
| Performance observations | Message sending averaged approximately 0.41 s. Realtime propagation averaged approximately 0.72 s. Live Analyze Conversation averaged approximately 3.75 s. Repeated Analyze Conversation averaged approximately 4.11 s. All measured operations completed successfully. |
| Deviations from expected behavior | One repeated AI analysis produced a contextually related but less appropriate suggested reply. Live AI latency varied between approximately 3 and 6 seconds. The Security Rules whitespace defect discovered during automated validation was fixed before final validation. |
| Remaining defects | No known blocking functional defect was observed during final Phase 3 validation. |
| Overall Phase 3 validation assessment | The proof of concept satisfied the implemented functional and validation objectives for the approved academic proof-of-concept scope. It should be described as implementation-ready and validated for the academic proof-of-concept scope, not as production-ready. |
