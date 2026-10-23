import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_MB = 12;

/* Photo picker with real validation and previews. There is no backend
   yet, so the files stay in the browser — only the file names travel
   with the order, and the copy on screen says exactly that. */
export default function PhotoUpload({ files, onChange, max = 40, label = 'Upload your photographs' }) {
  const inputRef = useRef(null);
  const [errors, setErrors] = useState([]);
  const [over, setOver] = useState(false);
  const urls = useRef(new Map());

  useEffect(() => {
    const map = urls.current;
    return () => {
      map.forEach((url) => URL.revokeObjectURL(url));
      map.clear();
    };
  }, []);

  const previewUrl = (file) => {
    const key = `${file.name}-${file.size}-${file.lastModified}`;
    if (!urls.current.has(key)) urls.current.set(key, URL.createObjectURL(file));
    return urls.current.get(key);
  };

  const accept = (incoming) => {
    const next = [];
    const problems = [];

    Array.from(incoming).forEach((file) => {
      const typeOk = ACCEPTED.includes(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
      if (!typeOk) {
        problems.push(`${file.name} — not a JPG, PNG, WEBP or HEIC image`);
        return;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        problems.push(`${file.name} — larger than ${MAX_MB} MB`);
        return;
      }
      const duplicate = files.some((f) => f.name === file.name && f.size === file.size);
      if (duplicate) {
        problems.push(`${file.name} — already added`);
        return;
      }
      next.push(file);
    });

    const room = max - files.length;
    if (next.length > room) {
      problems.push(`Only ${max} photos can be added to one order.`);
    }

    setErrors(problems);
    if (next.length) onChange([...files, ...next.slice(0, Math.max(0, room))]);
  };

  return (
    <div>
      <div
        className={`dropzone${over ? ' is-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer?.files?.length) accept(e.dataTransfer.files);
        }}
      >
        <ImagePlus size={26} aria-hidden="true" />
        <button className="btn btn--ghost btn--sm" type="button" onClick={() => inputRef.current?.click()}>
          {label}
        </button>
        <p className="dropzone__hint">
          Drag photos here or browse — JPG, PNG, WEBP or HEIC, up to {MAX_MB} MB each.
        </p>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="image/*"
          multiple
          aria-label={label}
          onChange={(e) => {
            if (e.target.files?.length) accept(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {errors.length > 0 && (
        <ul style={{ marginTop: 8, display: 'grid', gap: 3 }} role="alert">
          {errors.map((text) => (
            <li className="field-error" key={text}>
              {text}
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <>
          <div className="previews">
            {files.map((file, index) => (
              <figure className="preview" key={`${file.name}-${file.size}-${index}`}>
                <img src={previewUrl(file)} alt={`Selected photo: ${file.name}`} />
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => onChange(files.filter((_, i) => i !== index))}
                >
                  <X size={13} />
                </button>
              </figure>
            ))}
          </div>
          <p className="field-hint" style={{ marginTop: 8 }}>
            {files.length} photo{files.length === 1 ? '' : 's'} selected. They stay in your browser — we note the
            file names with your order and ask you to send the photos themselves once we confirm it.
          </p>
        </>
      )}
    </div>
  );
}
