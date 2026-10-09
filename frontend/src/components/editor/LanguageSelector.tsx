import { LANGUAGES, type LanguageOption } from "../../utils/languages";

interface LanguageSelectorProps {
  selected: LanguageOption;
  onChange: (lang: LanguageOption) => void;
  disabled?: boolean;
}

export default function LanguageSelector({ selected, onChange, disabled }: LanguageSelectorProps) {
  return (
    <select
      aria-label="Language"
      value={selected.monacoId}
      disabled={disabled}
      onChange={(e) => {
        const lang = LANGUAGES.find((l) => l.monacoId === e.target.value);
        if (lang) onChange(lang);
      }}
      className="h-9 rounded-md border border-line bg-raised px-2 text-sm text-neutral-100 hover:bg-[#2d2d30] disabled:opacity-50 md:h-8 md:text-xs"
    >
      {LANGUAGES.map((lang) => (
        <option key={lang.monacoId} value={lang.monacoId}>
          {lang.label}
        </option>
      ))}
    </select>
  );
}