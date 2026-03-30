# Agent Review Panel — Demo Recording
# VHS tape file for generating a terminal GIF demo.
#
# Install:  brew install charmbracelet/tap/vhs
# Run:      vhs docs/demo.tape
# Output:   docs/demo.gif
#
# Customize:
#   - Change Output to produce .mp4, .webm, or .gif
#   - Adjust Set Width/Height for different terminal sizes
#   - Change Set Theme to any base16 theme (e.g., "Dracula", "Catppuccin Mocha")
#   - Edit docs/demo-output.sh for content and pacing changes

# --- Terminal settings ---
Output "docs/demo.gif"
Set FontSize 14
Set Width 960
Set Height 540
Set Framerate 15
Set Theme "Catppuccin Mocha"
Set Padding 20
Set WindowBar "Colorful"
Set WindowBarSize 40

# --- Run the colored demo script ---
Set TypingSpeed 0
Type "clear; bash docs/demo-output.sh"
Enter
Sleep 60s
