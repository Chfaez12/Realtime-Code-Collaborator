import { LANGUAGES, type LanguageOption } from "../../utils/languages";

interface LanguageSelectorProps {
  selected: LanguageOption;
  onChange: (lang: LanguageOption) => void;
  disabled?: boolean; 
}

export default function LanguageSelector({ selected, onChange, disabled }: LanguageSelectorProps) {
  return (
    <select
      value={selected.monacoId}
      disabled={disabled}
      onChange={(e) => {
        const lang = LANGUAGES.find((l) => l.monacoId === e.target.value);
        if (lang) onChange(lang);
      }}
      style={{
        fontSize: "12px",
        padding: "4px 8px",
        backgroundColor: "#1e1e1e",
        color: "#fff",
        border: "1px solid #444",
        borderRadius: "4px",
      }}
    >
      {LANGUAGES.map((lang) => (
        <option key={lang.monacoId} value={lang.monacoId}>
          {lang.label}
        </option>
      ))}
    </select>
  );
}