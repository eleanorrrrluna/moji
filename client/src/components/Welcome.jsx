import { useState } from 'react';

export default function Welcome({ onDone }) {
  const [value, setValue] = useState('');

  function submit(e) {
    e.preventDefault();
    const n = value.trim();
    if (n) onDone(n);
  }

  return (
    <form className="screen" onSubmit={submit}>
      <h1 className="greeting">
        Before we begin —<br />
        what should MOJI call you?
      </h1>
      <input
        className="name-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="A name, a nickname, anything."
        autoFocus
        maxLength={30}
      />
      <div className="actions">
        <button className="primary" type="submit" disabled={!value.trim()}>
          That's me.
        </button>
      </div>
    </form>
  );
}
