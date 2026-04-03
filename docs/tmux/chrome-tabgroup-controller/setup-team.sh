#!/bin/bash

# chrome-tabgroup-controller Lite Team - Automated Setup Script
# Creates a tmux session with 2 Claude Code instances (PO, Worker)

set -e  # Exit on error

PROJECT_ROOT="/Users/dat/Work/01-active/ai-workspace/personal/chrome-tabgroup-controller"
SESSION_NAME="ctc"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPTS_DIR="$SCRIPT_DIR/prompts"

# Auto-scale window width based on number of panes
NUM_PANES=2
MIN_WIDTH_PER_PANE=100
WINDOW_WIDTH=$((NUM_PANES * MIN_WIDTH_PER_PANE))
WINDOW_HEIGHT=50

echo "Starting chrome-tabgroup-controller Lite Team Setup..."
echo "Project Root: $PROJECT_ROOT"
echo "Session Name: $SESSION_NAME"

# 1. Check if session already exists
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "Session '$SESSION_NAME' already exists!"
    read -p "Kill existing session and create new one? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        tmux kill-session -t $SESSION_NAME
        echo "Killed existing session"
    else
        echo "Aborted. Use 'tmux attach -t $SESSION_NAME' to attach"
        exit 0
    fi
fi

# 2. Verify tm-send is installed globally
echo "Verifying tm-send installation..."
if command -v tm-send > /dev/null 2>&1; then
    echo "tm-send is installed at: $(which tm-send)"
else
    echo ""
    echo "ERROR: tm-send is not installed!"
    echo ""
    echo "tm-send is a GLOBAL tool that must be installed to ~/.local/bin/tm-send"
    echo "It is NOT project-specific — one installation serves all projects."
    echo ""
    echo "Please install tm-send first before running this script."
    echo ""
    exit 1
fi

# 3. Start new tmux session
echo "Creating tmux session '$SESSION_NAME'..."
cd "$PROJECT_ROOT"
tmux new-session -d -s $SESSION_NAME

# 4. Create 2-pane layout
echo "Creating 2-pane layout..."
tmux split-window -h -t $SESSION_NAME
tmux select-layout -t $SESSION_NAME even-horizontal

# 5. Resize window
echo "Resizing window to ${WINDOW_WIDTH}x${WINDOW_HEIGHT}..."
tmux resize-window -t $SESSION_NAME -x $WINDOW_WIDTH -y $WINDOW_HEIGHT

# 6. Set pane titles and role names
tmux select-pane -t $SESSION_NAME:0.0 -T "PO"
tmux select-pane -t $SESSION_NAME:0.1 -T "Worker"

tmux set-option -p -t $SESSION_NAME:0.0 @role_name "PO"
tmux set-option -p -t $SESSION_NAME:0.1 @role_name "WORKER"

# 7. Get pane IDs
echo "Getting pane IDs..."
PANE_IDS=$(tmux list-panes -t $SESSION_NAME -F "#{pane_id}")
PO_PANE=$(echo "$PANE_IDS" | sed -n '1p')
WORKER_PANE=$(echo "$PANE_IDS" | sed -n '2p')

echo "Pane IDs:"
echo "  PO (Pane 0): $PO_PANE"
echo "  Worker (Pane 1): $WORKER_PANE"

# 8. Start Claude Code in each pane
echo "Starting Claude Code instances..."
tmux send-keys -t $SESSION_NAME:0.0 "cd $PROJECT_ROOT && claude --dangerously-skip-permissions" C-m
tmux send-keys -t $SESSION_NAME:0.1 "cd $PROJECT_ROOT && claude --dangerously-skip-permissions" C-m

# 9. Wait for Claude Code to start
echo "Waiting for Claude Code to start (15 seconds)..."
sleep 15

# 10. Initialize roles
echo "Initializing roles..."
tmux send-keys -t $SESSION_NAME:0.0 "/init-role PO" C-m
tmux send-keys -t $SESSION_NAME:0.0 C-m

tmux send-keys -t $SESSION_NAME:0.1 "/init-role WORKER" C-m
tmux send-keys -t $SESSION_NAME:0.1 C-m

# 11. Wait for initialization
echo "Waiting for role initialization (10 seconds)..."
sleep 10

echo ""
echo "=========================================="
echo "chrome-tabgroup-controller Team Setup Complete!"
echo "=========================================="
echo ""
echo "Session: $SESSION_NAME"
echo "Project: $PROJECT_ROOT"
echo ""
echo "Roles:"
echo "  PO (Pane 0): $PO_PANE"
echo "  Worker (Pane 1): $WORKER_PANE"
echo ""
echo "To attach to the session:"
echo "  tmux attach -t $SESSION_NAME"
echo ""
echo "To send messages to PO (Boss terminal):"
echo "  tm-send PO \"BOSS: Your message here\""
echo ""
echo "To list roles in session:"
echo "  tm-send --list"
echo ""
echo "Next steps:"
echo "1. Attach: tmux attach -t $SESSION_NAME"
echo "2. Verify both agents initialized properly"
echo "3. Send initial goal to PO via tm-send"
echo ""
echo "=========================================="
