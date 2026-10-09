import type { Monaco } from "@monaco-editor/react";
import type * as monaco from "monaco-editor";


interface Snippet {
  label: string;
  detail: string;
  body: string; // Monaco snippet syntax: ${1:placeholder} marks a stop for Tab, $0 is the final cursor position
}

interface LanguagePack {
  comments: string[]; // no suggestions after these inside a line
  keywords: string[];
  builtins: string[];
  members: string[]; // offered after "." or "->" when the name before it isn't a known one
  owners: Record<string, string[]>; // offered after "name." or "name::" for well-known names
  snippets: Snippet[];
}

const PYTHON: LanguagePack = {
  comments: ["#"],
  keywords: [
    "False", "None", "True", "and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del",
    "elif", "else", "except", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal",
    "not", "or", "pass", "raise", "return", "try", "while", "with", "yield", "match", "case",
  ],
  builtins: [
    "print", "input", "len", "range", "int", "str", "float", "bool", "list", "dict", "set", "tuple", "sorted",
    "reversed", "enumerate", "zip", "map", "filter", "sum", "min", "max", "abs", "round", "open", "isinstance",
    "type", "id", "dir", "help", "any", "all", "iter", "next", "hash", "chr", "ord", "bin", "hex", "oct", "pow",
    "divmod", "format", "repr", "callable", "getattr", "setattr", "hasattr", "super", "object", "property",
    "staticmethod", "classmethod", "Exception", "ValueError", "TypeError", "KeyError", "IndexError", "RuntimeError",
  ],
  members: [
    "append", "extend", "insert", "remove", "pop", "clear", "index", "count", "sort", "reverse", "copy", "keys",
    "values", "items", "get", "update", "setdefault", "add", "discard", "union", "intersection", "difference",
    "join", "split", "strip", "lstrip", "rstrip", "replace", "lower", "upper", "title", "capitalize", "startswith",
    "endswith", "find", "format", "encode", "decode", "isdigit", "isalpha", "isalnum", "isspace", "splitlines",
    "zfill", "center", "ljust", "rjust", "read", "readline", "readlines", "write", "close", "seek",
  ],
  owners: {
    math: ["sqrt", "floor", "ceil", "pow", "log", "log2", "log10", "sin", "cos", "tan", "pi", "e", "fabs", "factorial", "gcd", "inf"],
    random: ["random", "randint", "choice", "shuffle", "sample", "uniform", "seed", "randrange"],
    os: ["path", "getcwd", "listdir", "environ", "getenv", "mkdir", "remove", "rename", "walk"],
    sys: ["argv", "exit", "stdin", "stdout", "stderr", "path", "version", "maxsize", "setrecursionlimit"],
    json: ["dumps", "loads", "dump", "load"],
    time: ["time", "sleep", "perf_counter", "strftime", "monotonic"],
    datetime: ["now", "today", "strptime", "strftime", "timedelta", "date", "datetime"],
    re: ["match", "search", "findall", "sub", "compile", "split", "fullmatch", "finditer"],
    collections: ["Counter", "defaultdict", "deque", "OrderedDict", "namedtuple"],
    itertools: ["permutations", "combinations", "product", "accumulate", "chain", "count", "cycle", "groupby"],
    heapq: ["heappush", "heappop", "heapify", "nlargest", "nsmallest"],
    string: ["ascii_letters", "ascii_lowercase", "ascii_uppercase", "digits", "punctuation"],
  },
  snippets: [
    { label: "def", detail: "function", body: "def ${1:name}(${2:args}):\n\t${3:pass}" },
    { label: "class", detail: "class", body: "class ${1:Name}:\n\tdef __init__(self${2:, args}):\n\t\t${3:pass}" },
    { label: "for", detail: "for loop", body: "for ${1:item} in ${2:items}:\n\t${3:pass}" },
    { label: "forr", detail: "for loop over a range", body: "for ${1:i} in range(${2:n}):\n\t${3:pass}" },
    { label: "while", detail: "while loop", body: "while ${1:condition}:\n\t${2:pass}" },
    { label: "if", detail: "if", body: "if ${1:condition}:\n\t${2:pass}" },
    { label: "ifelse", detail: "if / else", body: "if ${1:condition}:\n\t${2:pass}\nelse:\n\t${3:pass}" },
    { label: "try", detail: "try / except", body: "try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${4:print(e)}" },
    { label: "with", detail: "open a file", body: 'with open(${1:"file.txt"}) as ${2:f}:\n\t${3:pass}' },
    { label: "ifmain", detail: "main guard", body: 'if __name__ == "__main__":\n\t${1:main()}' },
    { label: "listcomp", detail: "list comprehension", body: "[${1:x} for ${2:x} in ${3:items}]" },
    { label: "lambda", detail: "lambda", body: "lambda ${1:x}: ${2:x}" },
  ],
};

const JAVA: LanguagePack = {
  comments: ["//"],
  keywords: [
    "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class", "const", "continue",
    "default", "do", "double", "else", "enum", "extends", "final", "finally", "float", "for", "goto", "if",
    "implements", "import", "instanceof", "int", "interface", "long", "native", "new", "package", "private",
    "protected", "public", "return", "short", "static", "super", "switch", "synchronized", "this", "throw",
    "throws", "transient", "try", "void", "volatile", "while", "var", "record", "true", "false", "null",
  ],
  builtins: [
    "String", "Integer", "Double", "Long", "Boolean", "Character", "Math", "System", "Object", "List", "ArrayList",
    "LinkedList", "Map", "HashMap", "TreeMap", "Set", "HashSet", "TreeSet", "Queue", "Deque", "ArrayDeque",
    "PriorityQueue", "Stack", "Scanner", "Arrays", "Collections", "Optional", "StringBuilder", "Random", "Thread",
    "Runnable", "Exception", "RuntimeException", "IllegalArgumentException",
  ],
  members: [
    "length", "charAt", "substring", "indexOf", "equals", "equalsIgnoreCase", "toUpperCase", "toLowerCase", "trim",
    "split", "replace", "contains", "startsWith", "endsWith", "isEmpty", "size", "add", "get", "set", "remove", "put",
    "containsKey", "getOrDefault", "keySet", "values", "entrySet", "forEach", "stream", "map", "filter", "collect",
    "toString", "hashCode", "compareTo", "append", "insert", "reverse", "sort", "println", "print", "printf",
  ],
  owners: {
    System: ["out", "in", "err", "currentTimeMillis", "nanoTime", "exit", "lineSeparator", "getProperty"],
    out: ["println", "print", "printf", "flush"],
    Math: ["abs", "max", "min", "pow", "sqrt", "floor", "ceil", "round", "random", "sin", "cos", "PI", "E"],
    Arrays: ["sort", "fill", "asList", "toString", "copyOf", "copyOfRange", "equals", "stream"],
    Collections: ["sort", "reverse", "shuffle", "max", "min", "unmodifiableList", "emptyList", "swap"],
    Integer: ["parseInt", "valueOf", "MAX_VALUE", "MIN_VALUE", "toString", "compare", "toBinaryString"],
    String: ["valueOf", "format", "join"],
    List: ["of", "copyOf"],
    Character: ["isDigit", "isLetter", "isUpperCase", "isLowerCase", "toUpperCase", "toLowerCase", "getNumericValue"],
    Thread: ["sleep", "currentThread"],
  },
  snippets: [
    { label: "main", detail: "class with a main method", body: "public class Main {\n\tpublic static void main(String[] args) {\n\t\t$0\n\t}\n}" },
    { label: "psvm", detail: "main method", body: "public static void main(String[] args) {\n\t$0\n}" },
    { label: "sout", detail: "System.out.println", body: "System.out.println($0);" },
    { label: "fori", detail: "for loop", body: "for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t$0\n}" },
    { label: "foreach", detail: "for-each loop", body: "for (${1:String} ${2:item} : ${3:items}) {\n\t$0\n}" },
    { label: "if", detail: "if", body: "if (${1:condition}) {\n\t$0\n}" },
    { label: "ifelse", detail: "if / else", body: "if (${1:condition}) {\n\t$0\n} else {\n\t\n}" },
    { label: "try", detail: "try / catch", body: "try {\n\t$0\n} catch (${1:Exception} ${2:e}) {\n\t${2:e}.printStackTrace();\n}" },
    { label: "scanner", detail: "read input", body: "Scanner ${1:sc} = new Scanner(System.in);" },
    { label: "method", detail: "static method", body: "public static ${1:void} ${2:name}(${3}) {\n\t$0\n}" },
  ],
};

const C: LanguagePack = {
  comments: ["//"],
  keywords: [
    "auto", "break", "case", "char", "const", "continue", "default", "do", "double", "else", "enum", "extern",
    "float", "for", "goto", "if", "inline", "int", "long", "register", "restrict", "return", "short", "signed",
    "sizeof", "static", "struct", "switch", "typedef", "union", "unsigned", "void", "volatile", "while", "bool",
    "true", "false", "NULL",
  ],
  builtins: [
    "printf", "scanf", "fprintf", "sprintf", "snprintf", "puts", "fgets", "getchar", "putchar", "malloc", "calloc",
    "realloc", "free", "strlen", "strcpy", "strncpy", "strcmp", "strncmp", "strcat", "strchr", "strstr", "memcpy",
    "memset", "memmove", "atoi", "atof", "strtol", "abs", "rand", "srand", "time", "exit", "fopen", "fclose",
    "fread", "fwrite", "fseek", "ftell", "fflush", "sqrt", "pow", "ceil", "floor", "fabs", "sin", "cos", "tan",
    "log", "toupper", "tolower", "isdigit", "isalpha", "isspace", "stdin", "stdout", "stderr", "size_t", "FILE", "EOF",
  ],
  members: [],
  owners: {},
  snippets: [
    { label: "main", detail: "main function", body: "#include <stdio.h>\n\nint main(void) {\n\t$0\n\treturn 0;\n}" },
    { label: "inc", detail: "#include", body: "#include <${1:stdio.h}>" },
    { label: "printf", detail: "print", body: 'printf("${1:%d}\\n", ${2:value});' },
    { label: "scanf", detail: "read a value", body: 'scanf("${1:%d}", &${2:variable});' },
    { label: "for", detail: "for loop", body: "for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t$0\n}" },
    { label: "while", detail: "while loop", body: "while (${1:condition}) {\n\t$0\n}" },
    { label: "if", detail: "if", body: "if (${1:condition}) {\n\t$0\n}" },
    { label: "ifelse", detail: "if / else", body: "if (${1:condition}) {\n\t$0\n} else {\n\t\n}" },
    { label: "struct", detail: "struct", body: "struct ${1:Name} {\n\t$0\n};" },
    { label: "func", detail: "function", body: "${1:int} ${2:name}(${3:void}) {\n\t$0\n}" },
  ],
};

const CPP: LanguagePack = {
  comments: ["//"],
  keywords: [
    ...C.keywords,
    "class", "namespace", "template", "typename", "using", "public", "private", "protected", "virtual", "override",
    "final", "explicit", "friend", "new", "delete", "this", "try", "catch", "throw", "constexpr", "noexcept",
    "nullptr", "decltype", "operator", "static_cast", "dynamic_cast", "reinterpret_cast", "const_cast", "mutable",
  ],
  builtins: [
    "cout", "cin", "cerr", "endl", "string", "vector", "map", "unordered_map", "set", "unordered_set", "pair",
    "make_pair", "sort", "reverse", "min", "max", "swap", "getline", "to_string", "stoi", "stod", "size_t",
    "int64_t", "shared_ptr", "unique_ptr", "make_shared", "make_unique",
  ],
  members: [
    "size", "empty", "push_back", "pop_back", "back", "front", "begin", "end", "clear", "insert", "erase", "find",
    "count", "at", "emplace_back", "resize", "substr", "length", "c_str", "append", "compare", "first", "second",
    "push", "pop", "top",
  ],
  owners: {
    std: [
      "cout", "cin", "cerr", "endl", "string", "vector", "map", "unordered_map", "set", "unordered_set", "queue",
      "stack", "deque", "priority_queue", "pair", "make_pair", "tuple", "array", "list", "sort", "reverse", "min",
      "max", "swap", "find", "count", "accumulate", "getline", "to_string", "stoi", "stod", "stol", "abs", "sqrt",
      "pow", "unique_ptr", "shared_ptr", "make_unique", "make_shared", "move", "function", "thread", "mutex",
      "optional", "chrono", "ios", "cerr",
    ],
  },
  snippets: [
    { label: "main", detail: "main function", body: "#include <iostream>\nusing namespace std;\n\nint main() {\n\t$0\n\treturn 0;\n}" },
    { label: "inc", detail: "#include", body: "#include <${1:iostream}>" },
    { label: "cout", detail: "print", body: 'cout << ${1:"text"} << endl;' },
    { label: "cin", detail: "read a value", body: "cin >> ${1:x};" },
    { label: "for", detail: "for loop", body: "for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t$0\n}" },
    { label: "forr", detail: "range-based for", body: "for (auto& ${1:item} : ${2:items}) {\n\t$0\n}" },
    { label: "while", detail: "while loop", body: "while (${1:condition}) {\n\t$0\n}" },
    { label: "if", detail: "if", body: "if (${1:condition}) {\n\t$0\n}" },
    { label: "vec", detail: "vector", body: "vector<${1:int}> ${2:v};" },
    { label: "class", detail: "class", body: "class ${1:Name} {\npublic:\n\t${1:Name}() {}\n\t$0\n};" },
  ],
};

const GO: LanguagePack = {
  comments: ["//"],
  keywords: [
    "break", "case", "chan", "const", "continue", "default", "defer", "else", "fallthrough", "for", "func", "go",
    "goto", "if", "import", "interface", "map", "package", "range", "return", "select", "struct", "switch", "type",
    "var", "true", "false", "nil", "iota",
  ],
  builtins: [
    "append", "cap", "close", "copy", "delete", "len", "make", "new", "panic", "print", "println", "recover",
    "string", "int", "int8", "int16", "int32", "int64", "uint", "uint8", "uint16", "uint32", "uint64", "float32",
    "float64", "bool", "byte", "rune", "error", "any",
  ],
  members: [],
  owners: {
    fmt: ["Println", "Printf", "Print", "Sprintf", "Sprint", "Sprintln", "Fprintf", "Errorf", "Scan", "Scanln", "Scanf", "Sscanf"],
    strings: ["Contains", "Split", "Join", "Replace", "ReplaceAll", "ToUpper", "ToLower", "TrimSpace", "Trim", "HasPrefix", "HasSuffix", "Index", "Repeat", "Fields", "Builder", "NewReader"],
    strconv: ["Itoa", "Atoi", "ParseInt", "ParseFloat", "FormatInt", "Quote"],
    math: ["Sqrt", "Pow", "Abs", "Max", "Min", "Floor", "Ceil", "Round", "Pi", "MaxInt64", "Inf"],
    sort: ["Ints", "Strings", "Slice", "Sort", "Search"],
    os: ["Args", "Exit", "Stdin", "Stdout", "Stderr", "Getenv", "ReadFile"],
    errors: ["New", "Is", "As"],
    time: ["Now", "Sleep", "Since", "Duration", "Second", "Millisecond"],
    bufio: ["NewReader", "NewScanner", "NewWriter"],
    sync: ["WaitGroup", "Mutex", "Once"],
    unicode: ["IsDigit", "IsLetter", "IsUpper", "IsLower", "IsSpace", "ToUpper", "ToLower"],
  },
  snippets: [
    { label: "main", detail: "main program", body: 'package main\n\nimport "fmt"\n\nfunc main() {\n\t$0\n}' },
    { label: "func", detail: "function", body: "func ${1:name}(${2}) ${3:error} {\n\t$0\n}" },
    { label: "for", detail: "for loop", body: "for ${1:i} := 0; ${1:i} < ${2:n}; ${1:i}++ {\n\t$0\n}" },
    { label: "forr", detail: "range loop", body: "for ${1:i}, ${2:v} := range ${3:items} {\n\t$0\n}" },
    { label: "if", detail: "if", body: "if ${1:condition} {\n\t$0\n}" },
    { label: "iferr", detail: "error check", body: "if err != nil {\n\t${1:return err}\n}" },
    { label: "struct", detail: "struct", body: "type ${1:Name} struct {\n\t$0\n}" },
    { label: "switch", detail: "switch", body: "switch ${1:value} {\ncase ${2:x}:\n\t$0\ndefault:\n}" },
    { label: "go", detail: "goroutine", body: "go func() {\n\t$0\n}()" },
    { label: "println", detail: "print", body: 'fmt.Println(${1:"text"})' },
  ],
};

const RUST: LanguagePack = {
  comments: ["//"],
  keywords: [
    "as", "async", "await", "break", "const", "continue", "crate", "dyn", "else", "enum", "extern", "false", "fn",
    "for", "if", "impl", "in", "let", "loop", "match", "mod", "move", "mut", "pub", "ref", "return", "self", "Self",
    "static", "struct", "super", "trait", "true", "type", "unsafe", "use", "where", "while",
  ],
  builtins: [
    "println!", "print!", "eprintln!", "format!", "vec!", "panic!", "assert!", "assert_eq!", "write!", "writeln!",
    "todo!", "dbg!", "String", "Vec", "Option", "Some", "None", "Result", "Ok", "Err", "Box", "Rc", "Arc", "HashMap",
    "HashSet", "BTreeMap", "Mutex", "i8", "i16", "i32", "i64", "i128", "isize", "u8", "u16", "u32", "u64", "u128",
    "usize", "f32", "f64", "bool", "char", "str",
  ],
  members: [
    "len", "is_empty", "push", "pop", "insert", "remove", "iter", "iter_mut", "into_iter", "map", "filter", "collect",
    "unwrap", "expect", "unwrap_or", "unwrap_or_else", "clone", "to_string", "as_str", "trim", "split", "lines",
    "parse", "chars", "bytes", "contains", "starts_with", "ends_with", "sort", "sort_by", "join", "first", "last",
    "get", "get_mut", "take", "skip", "enumerate", "zip", "fold", "sum", "min", "max", "rev",
  ],
  owners: {
    String: ["new", "from", "with_capacity", "from_utf8"],
    Vec: ["new", "with_capacity", "from"],
    HashMap: ["new", "with_capacity"],
    Box: ["new"],
    Rc: ["new", "clone", "strong_count"],
    Arc: ["new", "clone", "strong_count"],
    std: ["io", "collections", "fmt", "cmp", "env", "fs", "process", "thread", "time", "rc", "sync", "mem"],
    io: ["stdin", "stdout", "Write", "Read", "BufRead"],
    collections: ["HashMap", "HashSet", "BTreeMap", "BTreeSet", "VecDeque", "BinaryHeap"],
    i32: ["MAX", "MIN", "from", "pow", "abs"],
    i64: ["MAX", "MIN", "from", "pow", "abs"],
    u32: ["MAX", "MIN", "from", "pow"],
    u64: ["MAX", "MIN", "from", "pow"],
    usize: ["MAX", "MIN", "from", "pow"],
    f64: ["MAX", "MIN", "EPSILON", "from"],
  },
  snippets: [
    { label: "main", detail: "main function", body: "fn main() {\n\t$0\n}" },
    { label: "fn", detail: "function", body: "fn ${1:name}(${2}) -> ${3:()} {\n\t$0\n}" },
    { label: "struct", detail: "struct", body: "struct ${1:Name} {\n\t$0\n}" },
    { label: "impl", detail: "impl block", body: "impl ${1:Name} {\n\t$0\n}" },
    { label: "enum", detail: "enum", body: "enum ${1:Name} {\n\t$0\n}" },
    { label: "match", detail: "match", body: "match ${1:value} {\n\t${2:pattern} => ${3:expr},\n\t_ => ${4:expr},\n}" },
    { label: "for", detail: "for loop", body: "for ${1:i} in ${2:0..n} {\n\t$0\n}" },
    { label: "iflet", detail: "if let", body: "if let ${1:Some(x)} = ${2:value} {\n\t$0\n}" },
    { label: "println", detail: "print", body: 'println!("{}", ${1:value});' },
    { label: "read", detail: "read a line", body: "let mut ${1:input} = String::new();\nstd::io::stdin().read_line(&mut ${1:input}).unwrap();" },
  ],
};

const PHP: LanguagePack = {
  comments: ["//", "#"],
  keywords: [
    "abstract", "and", "array", "as", "break", "callable", "case", "catch", "class", "clone", "const", "continue",
    "declare", "default", "do", "echo", "else", "elseif", "empty", "extends", "final", "finally", "fn", "for",
    "foreach", "function", "global", "if", "implements", "include", "include_once", "instanceof", "interface",
    "isset", "list", "match", "namespace", "new", "or", "print", "private", "protected", "public", "require",
    "require_once", "return", "static", "switch", "throw", "trait", "try", "unset", "use", "var", "while", "xor",
    "yield", "true", "false", "null",
  ],
  builtins: [
    "count", "strlen", "str_replace", "substr", "strpos", "strtolower", "strtoupper", "trim", "explode", "implode",
    "array_map", "array_filter", "array_merge", "array_keys", "array_values", "array_push", "array_pop",
    "array_shift", "array_unshift", "array_slice", "array_sum", "in_array", "array_key_exists", "sort", "rsort",
    "usort", "ksort", "json_encode", "json_decode", "var_dump", "print_r", "printf", "sprintf", "intval", "floatval",
    "is_array", "is_string", "is_numeric", "date", "time", "file_get_contents", "file_put_contents", "fopen", "fgets",
    "fclose", "rand", "mt_rand", "min", "max", "abs", "round", "floor", "ceil", "sqrt", "pow",
  ],
  members: [],
  owners: { self: [], parent: ["__construct"], static: [] },
  snippets: [
    { label: "php", detail: "opening tag", body: "<?php\n\n$0" },
    { label: "function", detail: "function", body: "function ${1:name}(${2}) {\n\t$0\n}" },
    { label: "class", detail: "class", body: "class ${1:Name} {\n\tpublic function __construct(${2}) {\n\t\t$0\n\t}\n}" },
    { label: "foreach", detail: "foreach loop", body: "foreach (\\$${1:items} as \\$${2:item}) {\n\t$0\n}" },
    { label: "for", detail: "for loop", body: "for (\\$${1:i} = 0; \\$${1:i} < ${2:n}; \\$${1:i}++) {\n\t$0\n}" },
    { label: "if", detail: "if", body: "if (${1:condition}) {\n\t$0\n}" },
    { label: "ifelse", detail: "if / else", body: "if (${1:condition}) {\n\t$0\n} else {\n\t\n}" },
    { label: "echo", detail: "print a line", body: 'echo ${1:"text"} . "\\n";' },
    { label: "try", detail: "try / catch", body: "try {\n\t$0\n} catch (${1:Exception} \\$${2:e}) {\n\techo \\$${2:e}->getMessage();\n}" },
  ],
};

const RUBY: LanguagePack = {
  comments: ["#"],
  keywords: [
    "alias", "and", "begin", "break", "case", "class", "def", "defined?", "do", "else", "elsif", "end", "ensure",
    "false", "for", "if", "in", "module", "next", "nil", "not", "or", "redo", "rescue", "retry", "return", "self",
    "super", "then", "true", "undef", "unless", "until", "when", "while", "yield",
  ],
  builtins: [
    "puts", "print", "p", "gets", "require", "require_relative", "attr_accessor", "attr_reader", "attr_writer",
    "include", "extend", "raise", "loop", "lambda", "proc", "format", "sprintf", "printf", "rand", "sleep",
    "Integer", "Float", "String", "Array", "Hash", "Comparable", "Enumerable", "Struct", "File", "Dir", "Time", "Math",
  ],
  members: [
    "each", "each_with_index", "map", "select", "reject", "reduce", "inject", "sum", "min", "max", "sort", "sort_by",
    "uniq", "flatten", "compact", "first", "last", "push", "pop", "shift", "unshift", "length", "size", "empty?",
    "include?", "join", "split", "strip", "chomp", "upcase", "downcase", "capitalize", "reverse", "to_s", "to_i",
    "to_f", "to_a", "to_sym", "keys", "values", "fetch", "key?", "merge", "delete", "times", "upto", "downto",
    "step", "zip", "take", "drop", "find", "any?", "all?", "none?", "count", "gsub", "sub", "start_with?",
    "end_with?", "nil?", "is_a?", "respond_to?",
  ],
  owners: {
    Math: ["sqrt", "sin", "cos", "tan", "log", "log2", "log10", "hypot", "cbrt", "PI", "E"],
    File: ["read", "write", "open", "exist?", "join", "basename", "dirname", "readlines", "foreach"],
    Time: ["now", "at", "mktime"],
    Dir: ["glob", "pwd"],
    Random: ["rand", "new_seed"],
  },
  snippets: [
    { label: "def", detail: "method", body: "def ${1:name}${2:(args)}\n\t$0\nend" },
    { label: "class", detail: "class", body: "class ${1:Name}\n\tdef initialize${2:(args)}\n\t\t$0\n\tend\nend" },
    { label: "each", detail: "each loop", body: "${1:items}.each do |${2:item}|\n\t$0\nend" },
    { label: "times", detail: "repeat n times", body: "${1:n}.times do |${2:i}|\n\t$0\nend" },
    { label: "if", detail: "if", body: "if ${1:condition}\n\t$0\nend" },
    { label: "ifelse", detail: "if / else", body: "if ${1:condition}\n\t$0\nelse\n\t\nend" },
    { label: "case", detail: "case", body: "case ${1:value}\nwhen ${2:x}\n\t$0\nelse\n\t\nend" },
    { label: "begin", detail: "begin / rescue", body: "begin\n\t$0\nrescue ${1:StandardError} => ${2:e}\n\tputs ${2:e}.message\nend" },
    { label: "attr", detail: "accessor", body: "attr_accessor :${1:name}" },
    { label: "puts", detail: "print a line", body: 'puts "${1:text}"' },
  ],
};

// Keys are the editor's language ids (the monacoId values in utils/languages.ts)
const PACKS: Record<string, LanguagePack> = {
  python: PYTHON,
  java: JAVA,
  c: C,
  cpp: CPP,
  go: GO,
  rust: RUST,
  php: PHP,
  ruby: RUBY,
};

// Walks the text before the cursor to see whether the cursor is inside a string or a comment
function scanLine(line: string, comments: string[]): { inString: boolean; inComment: boolean } {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (comments.some((c) => line.startsWith(c, i))) return { inString: false, inComment: true };
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
  }
  return { inString: quote !== null, inComment: false };
}

const MAX_SCANNED_CHARS = 200_000;
const MAX_WORDS = 300;

function documentWords(model: monaco.editor.ITextModel, skip: Set<string>, current: string): string[] {
  const found = new Set<string>();
  const text = model.getValue().slice(0, MAX_SCANNED_CHARS);
  for (const match of text.matchAll(/[A-Za-z_]\w{2,}/g)) {
    const word = match[0];
    if (word !== current && !skip.has(word)) found.add(word);
    if (found.size >= MAX_WORDS) break;
  }
  return [...found];
}

function createProvider(monacoApi: Monaco, pack: LanguagePack): monaco.languages.CompletionItemProvider {
  const kind = monacoApi.languages.CompletionItemKind;
  const known = new Set([...pack.keywords, ...pack.builtins]);
  const classify = (name: string) =>
    /^[A-Z][A-Z0-9_]*$/.test(name) ? kind.Constant : /^[A-Z]/.test(name) ? kind.Class : kind.Function;

  return {
    triggerCharacters: [".", ":", ">"],

    provideCompletionItems(model, position, context) {
      const before = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const state = scanLine(before, pack.comments);
      if (state.inComment || state.inString) return { suggestions: [] };

      const word = model.getWordUntilPosition(position);
      const range: monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      // After "name.", "name->" or "name::": members instead of the general list
      const access = /([A-Za-z_]\w*)?\s*(\.|->|::)\s*\w*$/.exec(before);
      if (access) {
        const owner = access[1];
        const isScope = access[2] === "::";
        const names = (owner && pack.owners[owner]) || (isScope ? [] : pack.members);
        return {
          suggestions: names.map((name) => ({
            label: name,
            kind: isScope ? kind.Function : kind.Method,
            insertText: name,
            range,
            sortText: `1${name}`,
          })),
        };
      }

      // A ":" or ">" typed on its own (a dict, a comparison) shouldn't open the list
      if (context.triggerKind === monacoApi.languages.CompletionTriggerKind.TriggerCharacter) {
        return { suggestions: [] };
      }

      return {
        suggestions: [
          ...pack.snippets.map((s) => ({
            label: s.label,
            kind: kind.Snippet,
            detail: s.detail,
            insertText: s.body,
            insertTextRules: monacoApi.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
            sortText: `0${s.label}`,
          })),
          ...pack.keywords.map((k) => ({ label: k, kind: kind.Keyword, insertText: k, range, sortText: `1${k}` })),
          ...pack.builtins.map((b) => ({ label: b, kind: classify(b), insertText: b, range, sortText: `2${b}` })),
          ...documentWords(model, known, word.word).map((w) => ({
            label: w,
            kind: kind.Text,
            insertText: w,
            range,
            sortText: `3${w}`,
          })),
        ],
      };
    },
  };
}

let registered = false;

// Call once, when the editor is first created
export function registerLanguageCompletions(monacoApi: Monaco): void {
  if (registered) return;
  registered = true;
  for (const [languageId, pack] of Object.entries(PACKS)) {
    monacoApi.languages.registerCompletionItemProvider(languageId, createProvider(monacoApi, pack));
  }
}