import type { DisplayUser, DisplayUserId } from '../types/chat'

type UserSwitcherProps = {
  users: DisplayUser[]
  selectedUserId: DisplayUserId
  onSelectUser: (userId: DisplayUserId) => void
}

export function UserSwitcher({
  users,
  selectedUserId,
  onSelectUser,
}: UserSwitcherProps) {
  return (
    <section className="panel user-switcher" aria-labelledby="user-switcher-title">
      <div>
        <h2 id="user-switcher-title">Display User</h2>
        <p className="section-note">Choose who is writing in this prototype.</p>
      </div>
      <div className="segmented-control" role="group" aria-label="Display user">
        {users.map((user) => (
          <button
            key={user.id}
            type="button"
            className={user.id === selectedUserId ? 'active' : ''}
            onClick={() => onSelectUser(user.id)}
          >
            {user.name}
          </button>
        ))}
      </div>
    </section>
  )
}
