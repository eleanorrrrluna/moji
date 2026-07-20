export default function Rest({ name }) {
  const displayName = name.charAt(0).toUpperCase() + name.slice(1);
  return (
    <div className="screen">
      <h1 className="greeting">Rest well, {displayName}.</h1>
      <p className="subgreeting">The page will be here tomorrow.</p>
    </div>
  );
}
