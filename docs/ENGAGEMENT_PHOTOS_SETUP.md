# Engagement Photos Setup Guide

## Overview
The wedding homepage features an elegant carousel of engagement photos that serves as the hero section background. Currently using placeholder images from Unsplash, but you can easily replace them with your actual engagement photos.

## Photo Requirements

### Image Specifications
- **Format**: JPG or WebP recommended
- **Dimensions**: 1920x1080 pixels (16:9 aspect ratio) or higher
- **File Size**: Under 2MB each for optimal performance
- **Quality**: High resolution for crisp display on all devices

### Recommended Photo Selection
Choose 5-7 engagement photos that:
1. Have good contrast for text overlay
2. Show variety in poses/locations
3. Are high quality and well-lit
4. Represent your story well
5. Work well as backgrounds (not too busy)

## Adding Your Photos

### Step 1: Prepare Your Images
1. Resize images to 1920x1080 pixels minimum
2. Optimize file sizes using tools like:
   - **Online**: TinyPNG, Squoosh.app
   - **Mac**: Image Capture, Preview
   - **PC**: Paint, GIMP
   - **Professional**: Photoshop, Lightroom

### Step 2: Upload Photos
1. Place your photos in: `/public/images/engagement/`
2. Name them sequentially:
   - `photo1.jpg`
   - `photo2.jpg`
   - `photo3.jpg`
   - etc.

### Step 3: Update the Code (Optional)
If you want more than 5 photos or different names:

1. Open `/app/page.tsx`
2. Find the `engagementPhotos` array (around line 8)
3. Add/modify entries:

```javascript
const engagementPhotos = [
  {
    src: '/images/engagement/photo1.jpg',
    alt: 'Emme and CeeJay engagement photo 1',
    placeholder: 'https://images.unsplash.com/...' // Remove this line once you have real photos
  },
  // Add more photos here...
]
```

### Step 4: Remove Placeholder Images
Once you have real photos, remove the `placeholder` property from each photo object in the array.

## Performance Optimization

### Image Optimization
For production, consider:
1. **WebP Format**: Better compression than JPG
2. **Next.js Image Component**: Automatic optimization
3. **Preloading**: Critical images load faster

### Advanced: Using Next.js Image Component
For better performance, you can upgrade to use Next.js `<Image>` component:

```javascript
import Image from 'next/image'

// In your carousel
<Image
  src={photo.src}
  alt={photo.alt}
  fill
  className="w-full h-full object-cover"
  priority={index === 0} // Preload first image
/>
```

## Backup Strategy
Keep original high-resolution photos backed up separately in case you need to:
- Re-optimize for different sizes
- Create different versions for different pages
- Update photos in the future

## Testing Your Photos
After adding photos:
1. Check the homepage at `http://localhost:3000`
2. Test carousel functionality (prev/next buttons)
3. Verify photos look good on mobile devices
4. Ensure text is still readable over images
5. Test loading performance

## Color Adjustment (Optional)
If your photos don't provide enough contrast for the text overlay, you can adjust the overlay in `/app/page.tsx`:

```javascript
// Find this line (around line 78) and adjust opacity:
<div className="absolute inset-0 bg-gradient-to-br from-green-900/40 via-transparent to-amber-900/40" />

// Make darker for better text contrast:
<div className="absolute inset-0 bg-gradient-to-br from-green-900/60 via-transparent to-amber-900/60" />
```

## Mobile Considerations
- Images are automatically responsive
- Carousel controls are touch-friendly
- Auto-advance pauses when users interact
- Photos should look good at all screen sizes

Your engagement photos will create a beautiful, personal welcome experience for your wedding guests!