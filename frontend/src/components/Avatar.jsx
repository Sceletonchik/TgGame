export default function Avatar({ user, size = 40 }) {
  const initials = user
    ? (user.first_name?.[0] || '') + (user.last_name?.[0] || '')
    : '?';

  if (user?.photo_url) {
    return (
      <img
        className="avatar"
        src={user.photo_url}
        alt={user.first_name}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        onError={e => { e.target.style.display = 'none'; e.target.nextSibling?.style && (e.target.nextSibling.style.display = 'flex'); }}
      />
    );
  }

  return (
    <div
      className="avatar-fallback"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials.toUpperCase()}
    </div>
  );
}
