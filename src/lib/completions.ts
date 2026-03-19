export interface CommandInfo {
  name: string;
  description: string;
  options: string[];
}

export function getCommandRegistry(): CommandInfo[] {
  return [
    {
      name: "track",
      description: "Scan and record AI tool usage data",
      options: ["--since", "--tool", "--daemon"],
    },
    {
      name: "costs",
      description: "View AI tool cost breakdown and analytics",
      options: [
        "--today",
        "--week",
        "--month",
        "--tool",
        "--project",
        "--detailed",
        "--json",
      ],
    },
    {
      name: "budget",
      description: "Manage AI tool spending budgets",
      options: ["--monthly", "--daily", "--warn-at"],
    },
    {
      name: "sync",
      description: "Upload usage data to Kova cloud dashboard",
      options: ["--since", "--dry-run"],
    },
    {
      name: "report",
      description: "Generate AI tool cost reports",
      options: ["--format", "--output", "--month"],
    },
    {
      name: "login",
      description: "Log in to the Kova dashboard",
      options: [],
    },
    {
      name: "logout",
      description: "Log out from the Kova dashboard",
      options: [],
    },
    {
      name: "account",
      description: "View account and subscription details",
      options: [],
    },
    {
      name: "completions",
      description: "Generate shell completion scripts",
      options: [],
    },
  ];
}

export function generateBashCompletion(): string {
  const commands = getCommandRegistry();
  const cmdNames = commands.map((c) => c.name).join(" ");

  let script = `#!/bin/bash
# Kova CLI bash completions
# Add to ~/.bashrc: eval "$(kova completions bash)"

_kova_completions() {
  local cur prev commands
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  commands="${cmdNames}"

  if [[ \${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
    return 0
  fi

  case "\${COMP_WORDS[1]}" in
`;

  for (const cmd of commands) {
    if (cmd.options.length > 0) {
      const flags = cmd.options.join(" ");
      script += `    ${cmd.name})\n      COMPREPLY=( $(compgen -W "${flags}" -- "\${cur}") )\n      ;;\n`;
    }
  }

  script += `  esac
}

complete -F _kova_completions kova
`;
  return script;
}

export function generateZshCompletion(): string {
  const commands = getCommandRegistry();

  let script = `#compdef kova
# Kova CLI zsh completions
# Add to ~/.zshrc: eval "$(kova completions zsh)"

_kova() {
  local -a commands
  commands=(
`;

  for (const cmd of commands) {
    script += `    '${cmd.name}:${cmd.description}'\n`;
  }

  script += `  )

  _arguments -C \\
    '1:command:->command' \\
    '*::options:->options'

  case $state in
    command)
      _describe 'kova command' commands
      ;;
    options)
      case $words[1] in
`;

  for (const cmd of commands) {
    if (cmd.options.length > 0) {
      script += `        ${cmd.name})\n          _arguments \\\n`;
      for (const flag of cmd.options) {
        script += `            '${flag}[${flag} option]' \\\n`;
      }
      script += `          ;;\n`;
    }
  }

  script += `      esac
      ;;
  esac
}

_kova "$@"
`;
  return script;
}

export function generateFishCompletion(): string {
  const commands = getCommandRegistry();

  let script = `# Kova CLI fish completions
# Save to: ~/.config/fish/completions/kova.fish

# Disable file completions
complete -c kova -f

# Commands
`;

  for (const cmd of commands) {
    script += `complete -c kova -n "__fish_use_subcommand" -a "${cmd.name}" -d "${cmd.description}"\n`;
  }

  script += `\n# Command options\n`;

  for (const cmd of commands) {
    for (const flag of cmd.options) {
      const flagName = flag.replace(/^--/, "");
      script += `complete -c kova -n "__fish_seen_subcommand_from ${cmd.name}" -l "${flagName}" -d "${flag}"\n`;
    }
  }

  return script;
}
