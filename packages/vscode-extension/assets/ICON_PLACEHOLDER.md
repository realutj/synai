# Icon Placeholder

VS Code extension requires a 128x128 PNG icon.

## Create Icon:

1. **Online Tools:**
   - Use Canva: https://www.canva.com
   - Use Figma: https://www.figma.com
   - Use DALL-E: https://labs.openai.com

2. **Design Requirements:**
   - Size: 128x128 pixels
   - Format: PNG
   - Name: `icon.png`
   - Style: Simple, recognizable logo
   - Colors: Match SynAI brand

3. **Quick Solution:**
   ```bash
   # Convert SVG to PNG using ImageMagick
   magick convert -background transparent -size 128x128 sidebar-icon.svg icon.png
   ```

## Temporary Icon

Until you create a proper icon, you can:

1. Use a simple colored square
2. Use a text-based icon
3. Download a free icon from:
   - https://www.flaticon.com
   - https://icons8.com
   - https://www.iconfinder.com

**Important:** Save the final icon as `assets/icon.png`
