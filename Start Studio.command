#!/bin/zsh
cd "$(dirname "$0")" || exit 1
studio_node="$(command -v node)"
if [[ -z "$studio_node" ]]; then
  studio_node=""
fi
if [[ ! -x "$studio_node" ]]; then
  echo "Node.js 24 or newer is needed to start the studio."
  read -r
  exit 1
fi
mkdir -p .studio
studio_ollama_pid=''
if ! /usr/bin/curl -fsS --max-time 1 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  studio_ollama="$(command -v ollama)"
  if [[ -z "$studio_ollama" ]]; then
    studio_ollama='/Applications/Ollama.app/Contents/Resources/ollama'
  fi
  if [[ -x "$studio_ollama" ]]; then
    OLLAMA_NO_CLOUD=1 OLLAMA_CONTEXT_LENGTH=16384 OLLAMA_NUM_PARALLEL=1 OLLAMA_HOST=127.0.0.1:11434 "$studio_ollama" serve >.studio/ollama.log 2>&1 &
    studio_ollama_pid=$!
  else
    echo 'Install Ollama and download qwen3:4b to enable the free local specialists. Template preview still works.'
  fi
fi
trap 'if [[ -n "$studio_ollama_pid" ]]; then kill "$studio_ollama_pid" 2>/dev/null; fi' EXIT
open http://127.0.0.1:4310
"$studio_node" studio-server.mjs
