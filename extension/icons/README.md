# SignSpeak Extension Icons

This directory should contain the following icon files for the browser extension:

## Required Icons

- `icon16.png` - 16x16 pixels (toolbar icon)
- `icon32.png` - 32x32 pixels (Windows and other platforms)
- `icon48.png` - 48x48 pixels (extension management page)
- `icon128.png` - 128x128 pixels (Chrome Web Store)

## Icon Design Guidelines

### Visual Elements

- **Primary Symbol**: Hand gesture or sign language symbol
- **Color Scheme**: Blue gradient (#667eea to #764ba2)
- **Style**: Modern, clean, accessible
- **Background**: Transparent or white

### Accessibility

- High contrast for visibility
- Clear at small sizes
- Recognizable symbol
- Consistent with brand identity

## Creating Icons

### Using Design Tools

1. **Figma/Sketch**: Create vector icons and export at required sizes
2. **Photoshop/GIMP**: Design at high resolution and resize
3. **Online Tools**: Use icon generators with custom designs

### Recommended Tools

- [Figma](https://figma.com) - Free, web-based design tool
- [Icon Generator](https://iconifier.net) - Online icon creator
- [Canva](https://canva.com) - Simple design tool
- [GIMP](https://gimp.org) - Free image editor

## Placeholder Icons

For development purposes, you can create simple placeholder icons:

### Quick Creation Script

```bash
# Create simple colored squares as placeholders
convert -size 16x16 xc:'#667eea' icon16.png
convert -size 32x32 xc:'#667eea' icon32.png
convert -size 48x48 xc:'#667eea' icon48.png
convert -size 128x128 xc:'#667eea' icon128.png
```

### Using Online Icon Generator

1. Go to [favicon.io](https://favicon.io)
2. Choose "Generate from Text"
3. Enter "🤟" or "SL" as text
4. Select blue color scheme
5. Download and rename files

## Icon Content Ideas

### Symbol Options

- 🤟 Sign language "I love you" gesture
- 👋 Wave hand
- ✋ Stop gesture
- 🤲 Praying hands
- 📱 Communication device
- 🔊 Sound waves with hand
- 💬 Speech bubble with hand

### Text Options

- "SL" (Sign Language)
- "SignSpeak"
- "🤟"
- "ASL"

## File Requirements

### Format

- PNG format required
- Transparent background preferred
- Optimized for web use

### Size Specifications

- **16x16**: Must be clear at small size
- **32x32**: Standard Windows icon size
- **48x48**: Extension management page
- **128x128**: Chrome Web Store display

### Quality Guidelines

- Sharp edges at all sizes
- Consistent color scheme
- Professional appearance
- Accessible design

## Testing Icons

### Browser Testing

1. Load extension with icons
2. Check appearance in toolbar
3. Verify visibility in extension management
4. Test on different screen resolutions

### Accessibility Testing

1. Check contrast ratios
2. Verify readability at small sizes
3. Test with color vision differences
4. Ensure clear symbol recognition

## Legal Considerations

### Copyright

- Use original designs or properly licensed assets
- Avoid copyrighted symbols or logos
- Consider trademark implications

### Brand Guidelines

- Maintain consistent visual identity
- Follow accessibility standards
- Respect cultural sensitivity

## Resources

### Free Icon Resources

- [Feather Icons](https://feathericons.com)
- [Heroicons](https://heroicons.com)
- [Material Icons](https://material.io/icons)
- [Font Awesome](https://fontawesome.com)

### Design Inspiration

- [Icon Design Guidelines](https://developer.chrome.com/docs/webstore/images/)
- [Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Material Design Icons](https://material.io/design/iconography/)

---

**Note**: Replace placeholder icons with professionally designed ones before publishing the extension.
