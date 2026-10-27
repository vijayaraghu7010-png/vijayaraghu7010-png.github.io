import { CARD_FONTS, MESSAGE_MAX } from '../../data/hamperKit';

/* The card in the lid. Typing shows up on the card in the 3D preview
   as it is typed, which is the whole reason it is modelled rather
   than left as a form field. */
export default function MessagePanel({ design, change }) {
  const { message } = design;

  return (
    <div className="stack">
      <label className="switch">
        <input
          type="checkbox"
          checked={message.showCard}
          onChange={(e) => change({ type: 'message', patch: { showCard: e.target.checked } })}
        />
        <span>Include a handwritten card in the lid</span>
      </label>

      {!message.showCard && (
        <p className="field-hint">
          Turn this on to see the card in the box. We write it out by hand before the hamper is packed.
        </p>
      )}

      {message.showCard && (
        <>
          <div className="field">
            <label htmlFor="msg-to">Who it is for</label>
            <input
              id="msg-to"
              type="text"
              value={message.to}
              maxLength={60}
              placeholder="e.g. Asha"
              onChange={(e) => change({ type: 'message', patch: { to: e.target.value } })}
            />
          </div>

          <div className="field">
            <label htmlFor="msg-body">Your message</label>
            <textarea
              id="msg-body"
              value={message.body}
              maxLength={MESSAGE_MAX}
              rows={4}
              placeholder="Two years, and I would choose this again every time."
              onChange={(e) => change({ type: 'message', patch: { body: e.target.value } })}
            />
            <p className="field-hint">
              {message.body.length}/{MESSAGE_MAX}. Six lines fit on the card; anything longer is written on the back.
            </p>
          </div>

          <div className="field">
            <label htmlFor="msg-from">Signed</label>
            <input
              id="msg-from"
              type="text"
              value={message.from}
              maxLength={60}
              placeholder="e.g. Ravi"
              onChange={(e) => change({ type: 'message', patch: { from: e.target.value } })}
            />
          </div>

          <fieldset className="swatches">
            <legend>Handwriting</legend>
            <div className="chips">
              {CARD_FONTS.map((font) => (
                <button
                  key={font.id}
                  type="button"
                  className={`chip${message.fontId === font.id ? ' is-on' : ''}`}
                  aria-pressed={message.fontId === font.id}
                  style={{ fontFamily: font.css }}
                  onClick={() => change({ type: 'message', patch: { fontId: font.id } })}
                >
                  {font.label}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}
    </div>
  );
}
