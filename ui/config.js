export const isGhPages = location.hostname.endsWith('github.io');
export const apiBase = isGhPages ? 'https://emafuma.mywire.org:3000' : '';

export const FETCH_STEPS = [
  { id: 'stats',        label: 'Stats' },
  { id: 'stars',        label: 'Stars' },
  { id: 'commits',      label: 'Commits' },
  { id: 'PRs',          label: 'PRs' },
  { id: 'issues',       label: 'Issues' },
  { id: 'forks',        label: 'Forks' },
  { id: 'contributors', label: 'Contributors' },
  { id: 'GH mentions',  label: 'GH Mentions' },
  { id: 'HackerNews',   label: 'HN' },
  { id: 'YouTube',      label: 'YouTube' },
  { id: 'releases',     label: 'Releases' },
  { id: 'NPM',          label: 'NPM' },
  { id: 'PyPI',         label: 'PyPI' },
  { id: 'Cargo',        label: 'Cargo' },
  { id: 'Homebrew',     label: 'Homebrew' },
];

export const LANG_COLORS = {
  'JavaScript': '#f1e05a', 'TypeScript': '#3178c6', 'Python': '#3572A5', 'Java': '#b07219',
  'C': '#555555', 'C++': '#f34b7d', 'C#': '#178600', 'Go': '#00ADD8', 'Rust': '#dea584',
  'Ruby': '#701516', 'PHP': '#4F5D95', 'Swift': '#F05138', 'Kotlin': '#A97BFF',
  'Dart': '#00B4AB', 'Scala': '#c22d40', 'Shell': '#89e051', 'Lua': '#000080',
  'Perl': '#0298c3', 'Haskell': '#5e5086', 'R': '#198CE7', 'Julia': '#a270ba',
  'Elixir': '#6e4a7e', 'Clojure': '#db5855', 'Erlang': '#B83998', 'OCaml': '#3be133',
  'F#': '#b845fc', 'Zig': '#ec915c', 'Nim': '#ffc200', 'V': '#4f87c4',
  'HTML': '#e34c26', 'CSS': '#563d7c', 'SCSS': '#c6538c', 'Vue': '#41b883',
  'Svelte': '#ff3e00', 'Objective-C': '#438eff', 'Objective-C++': '#6866fb',
  'Assembly': '#6E4C13', 'Makefile': '#427819', 'Dockerfile': '#384d54',
  'HCL': '#844FBA', 'Nix': '#7e7eff', 'PowerShell': '#012456',
  'Groovy': '#4298b8', 'CoffeeScript': '#244776', 'Vim Script': '#199f4b',
  'Emacs Lisp': '#c065db', 'TeX': '#3D6117', 'Jupyter Notebook': '#DA5B0B',
  'Solidity': '#AA6746', 'MATLAB': '#e16737', 'Fortran': '#4d41b1',
  'VHDL': '#adb2cb', 'Verilog': '#b2b7f8', 'SystemVerilog': '#DAE1C2',
  'D': '#ba595e', 'Ada': '#02f88c', 'Pascal': '#E3F171', 'Prolog': '#74283c',
  'Racket': '#3c5caa', 'Scheme': '#1e4aec', 'Common Lisp': '#3fb68b',
  'Crystal': '#000100', 'Elm': '#60B5CC', 'PureScript': '#1D222D',
  'Reason': '#ff5847', 'Hack': '#878787', 'COBOL': '#a6a7aa',
};
