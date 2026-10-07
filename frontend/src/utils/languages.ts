export interface LanguageOption {
  label: string;
  monacoId: string;   
  pistonId: string;   
  extension: string;
}

export const LANGUAGES: LanguageOption[] = [
  { label: "JavaScript", monacoId: "javascript", pistonId: "javascript", extension: "js" },
  { label: "TypeScript", monacoId: "typescript", pistonId: "typescript", extension: "ts" },
  { label: "Python", monacoId: "python", pistonId: "python", extension: "py" },
  { label: "Java", monacoId: "java", pistonId: "java", extension: "java" },
  { label: "C", monacoId: "c", pistonId: "c", extension: "c" },
  { label: "C++", monacoId: "cpp", pistonId: "cpp", extension: "cpp" },
  { label: "Go", monacoId: "go", pistonId: "go", extension: "go" },
  { label: "Rust", monacoId: "rust", pistonId: "rust", extension: "rs" },
  { label: "PHP", monacoId: "php", pistonId: "php", extension: "php" },
  { label: "Ruby", monacoId: "ruby", pistonId: "ruby", extension: "rb" },
];

export const DEFAULT_LANGUAGE = LANGUAGES[0]; 