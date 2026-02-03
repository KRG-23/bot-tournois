#!/usr/bin/env bash
# Interactive toolbox setup for the Warhammer 40k Discord bot host (VPS OVH + Saltbox coexistence).
# - Each step asks for confirmation (Y/n). Press Enter to skip a step.
# - Tested for Debian/Ubuntu. Run as a sudo-capable user.

set -euo pipefail

confirm() {
  local prompt="${1:-Proceed?}"
  read -r -p "$prompt [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]]
}

info()  { printf "\033[1;34m[INFO]\033[0m %s\n" "$*"; }
warn()  { printf "\033[1;33m[WARN]\033[0m %s\n" "$*"; }
error() { printf "\033[1;31m[ERR]\033[0m  %s\n" "$*"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { warn "Missing dependency: $1"; return 1; }
}

main() {
  info "Starting interactive setup. You can skip any step."

  # 1) Update APT cache
  if confirm "Update APT package index?"; then
    sudo apt-get update
  else
    info "Skipping apt-get update."
  fi

  # 2) Base CLI tools
  if confirm "Install base CLI tools (git, curl, jq, rsync, htop, lsof, make, unzip)?"; then
    sudo apt-get install -y git curl jq rsync htop lsof make unzip
  fi

  # 3) Python/pipx (optional helpers like pre-commit)
  if confirm "Install python3-pip and pipx?"; then
    sudo apt-get install -y python3-pip python3-venv pipx
    pipx ensurepath || true
  fi

  # 4) Docker Engine + Compose plugin
  if confirm "Install/refresh Docker Engine and docker compose plugin?"; then
    if ! require_cmd docker; then
      sudo apt-get install -y ca-certificates gnupg
      sudo install -m 0755 -d /etc/apt/keyrings
      curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
      echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
        $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
      sudo apt-get update
      sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
      sudo usermod -aG docker "${USER}"
      info "Docker installed. You may need to log out/in for group membership to apply."
    else
      info "Docker already present; installing compose/buildx plugins if missing."
      sudo apt-get install -y docker-buildx-plugin docker-compose-plugin
    fi
  fi

  # 5) direnv (or skip)
  if confirm "Install direnv (env management for per-project .envrc)?"; then
    sudo apt-get install -y direnv
    warn "Remember to add 'eval \"\$(direnv hook bash)\"' or zsh equivalent to your shell rc."
  fi

  # 6) Security basics
  if confirm "Install and enable fail2ban (SSH protection)?"; then
    sudo apt-get install -y fail2ban
    sudo systemctl enable --now fail2ban
  fi

  if confirm "Configure Docker log rotation (json-file 10m, max 3 files)?"; then
    sudo mkdir -p /etc/docker
    cat <<'EOF' | sudo tee /etc/docker/daemon.json >/dev/null
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
    sudo systemctl restart docker
  fi

  # 7) Optional scanners
  if confirm "Install Trivy (container/image scanner)?"; then
    sudo apt-get install -y wget apt-transport-https gnupg lsb-release
    wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo gpg --dearmor -o /usr/share/keyrings/trivy.gpg
    echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" \
      | sudo tee /etc/apt/sources.list.d/trivy.list >/dev/null
    sudo apt-get update
    sudo apt-get install -y trivy
  fi

  # 8) Docker network for reverse proxy
  if confirm "Create shared docker network 'bot_proxy' for reverse-proxy ingress?"; then
    if docker network inspect bot_proxy >/dev/null 2>&1; then
      info "Network bot_proxy already exists."
    else
      docker network create bot_proxy
      info "Network bot_proxy created."
    fi
  fi

  # 9) Create project directories
  if confirm "Create /opt/bot-warhammer/{bot,api,data/{postgres,redis,backups}} ?"; then
    sudo mkdir -p /opt/bot-warhammer/bot
    sudo mkdir -p /opt/bot-warhammer/api
    sudo mkdir -p /opt/bot-warhammer/data/{postgres,redis,backups}
    sudo chown -R "${USER}:${USER}" /opt/bot-warhammer
  fi

  # 10) Firewall (ufw) — optional to avoid conflict with Saltbox
  if confirm "Set up ufw to allow SSH (22) and HTTP/HTTPS (80/443), deny rest?"; then
    sudo apt-get install -y ufw
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    sudo ufw allow 22/tcp
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    warn "Review Saltbox port needs before enabling."
    sudo ufw enable
  fi

  info "Setup steps complete. Consider rebooting if Docker group membership changed."
}

main "$@"
