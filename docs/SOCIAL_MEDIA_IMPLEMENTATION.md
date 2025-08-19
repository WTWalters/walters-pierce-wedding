# Social Media Integration Implementation Guide
## Instagram & Snapchat Wedding Integration

---

## 🔧 Technical Setup

### Instagram Basic Display API Setup

1. **Create Facebook App**
   ```
   1. Go to developers.facebook.com
   2. Create new app → Type: Consumer
   3. Add Instagram Basic Display product
   ```

2. **Configure Instagram App**
   ```javascript
   // Environment Variables
   INSTAGRAM_APP_ID=your_app_id
   INSTAGRAM_APP_SECRET=your_app_secret
   INSTAGRAM_REDIRECT_URI=https://walters-pierce-wedding.com/api/instagram/callback
   ```

3. **API Implementation**
   ```javascript
   // app/api/instagram/fetch-posts/route.ts
   import { NextResponse } from 'next/server';
   
   export async function GET() {
     const hashtag = 'EmmeLovesCeeJay2026';
     
     // Fetch recent media with hashtag
     const response = await fetch(
       `https://graph.instagram.com/ig_hashtag_search?` +
       `user_id=${process.env.INSTAGRAM_USER_ID}&` +
       `q=${hashtag}&` +
       `access_token=${process.env.INSTAGRAM_ACCESS_TOKEN}`
     );
     
     const data = await response.json();
     const hashtagId = data.data[0].id;
     
     // Get recent media for hashtag
     const mediaResponse = await fetch(
       `https://graph.instagram.com/${hashtagId}/recent_media?` +
       `user_id=${process.env.INSTAGRAM_USER_ID}&` +
       `fields=id,media_type,media_url,username,caption,timestamp&` +
       `access_token=${process.env.INSTAGRAM_ACCESS_TOKEN}`
     );
     
     const posts = await mediaResponse.json();
     
     // Store in database for moderation
     for (const post of posts.data) {
       await prisma.socialPosts.upsert({
         where: { post_id: post.id },
         update: {
           caption: post.caption,
           media_url: post.media_url,
           username: post.username,
           posted_at: new Date(post.timestamp)
         },
         create: {
           platform: 'instagram',
           post_id: post.id,
           username: post.username,
           caption: post.caption,
           media_url: post.media_url,
           media_type: post.media_type,
           posted_at: new Date(post.timestamp),
           is_approved: false
         }
       });
     }
     
     return NextResponse.json({ success: true, count: posts.data.length });
   }
   ```

---

## 📱 Snapchat Integration

### Custom Geofilter Setup

1. **Design Specifications**
   ```
   Dimensions: 1080 x 1920 pixels
   File Type: PNG with transparency
   File Size: Under 300KB
   Safe Zone: 310px top/bottom margins
   ```

2. **Geofilter Design Template**
   ```
   ┌─────────────────────┐
   │                     │ ← 310px safe zone
   │  ╔═══════════════╗  │
   │  ║ Emme & CeeJay ║  │
   │  ║   09.15.26    ║  │
   │  ╚═══════════════╝  │
   │    [Decorative      │
   │     Green/Gold      │
   │     Elements]       │
   │                     │ ← 310px safe zone
   └─────────────────────┘
   ```

3. **Submission Process**
   ```markdown
   1. Create design in Photoshop/Canva
   2. Go to snapchat.com/create
   3. Select "Filters & Lenses"
   4. Choose "Community Filters"
   5. Upload design
   6. Set geofence (venue location)
   7. Set date/time (24 hours)
   8. Submit for review (7-10 days)
   9. Cost: ~$5-20 depending on area/time
   ```

---

## 🖼️ Social Wall Component

### React Component Implementation

```tsx
// components/social/SocialWall.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Masonry from 'react-masonry-css';

interface SocialPost {
  id: string;
  platform: 'instagram' | 'snapchat';
  username: string;
  media_url: string;
  caption: string;
  likes_count: number;
  posted_at: Date;
  is_featured: boolean;
}

export function SocialWall() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [filter, setFilter] = useState<'all' | 'featured'>('all');
  
  useEffect(() => {
    // Fetch approved posts
    fetchPosts();
    
    // Set up real-time updates
    const interval = setInterval(fetchPosts, 60000); // Every minute
    
    return () => clearInterval(interval);
  }, [filter]);
  
  const fetchPosts = async () => {
    const response = await fetch(`/api/social/posts?filter=${filter}`);
    const data = await response.json();
    setPosts(data.posts);
  };
  
  const breakpointColumns = {
    default: 4,
    1100: 3,
    700: 2,
    500: 1
  };
  
  return (
    <div className="social-wall">
      {/* Header */}
      <div className="social-header">
        <h2 className="text-4xl font-playfair text-green-900">
          #EmmeLovesCeeJay2026
        </h2>
        <div className="filters">
          <button 
            onClick={() => setFilter('all')}
            className={filter === 'all' ? 'active' : ''}
          >
            All Posts
          </button>
          <button 
            onClick={() => setFilter('featured')}
            className={filter === 'featured' ? 'active' : ''}
          >
            Featured ⭐
          </button>
        </div>
      </div>
      
      {/* Masonry Grid */}
      <Masonry
        breakpointCols={breakpointColumns}
        className="social-masonry-grid"
        columnClassName="social-masonry-column"
      >
        <AnimatePresence>
          {posts.map((post) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="social-post-card"
            >
              {post.is_featured && (
                <div className="featured-badge">⭐ Featured</div>
              )}
              
              <div className="post-image">
                <img 
                  src={post.media_url} 
                  alt={post.caption}
                  loading="lazy"
                />
              </div>
              
              <div className="post-info">
                <div className="post-header">
                  <span className="username">@{post.username}</span>
                  <span className="platform-icon">
                    {post.platform === 'instagram' ? '📷' : '👻'}
                  </span>
                </div>
                
                {post.caption && (
                  <p className="caption">{post.caption}</p>
                )}
                
                <div className="post-footer">
                  <span className="likes">❤️ {post.likes_count}</span>
                  <span className="time">
                    {new Date(post.posted_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </Masonry>
      
      {/* Live Update Indicator */}
      <div className="live-indicator">
        <span className="pulse"></span>
        <span>Live Updates</span>
      </div>
    </div>
  );
}
```

### Styling

```css
/* styles/social-wall.css */
.social-wall {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.social-header {
  text-align: center;
  margin-bottom: 3rem;
}

.filters {
  margin-top: 1rem;
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.filters button {
  padding: 0.5rem 1.5rem;
  border: 2px solid #00330a;
  background: transparent;
  color: #00330a;
  border-radius: 25px;
  cursor: pointer;
  transition: all 0.3s;
}

.filters button.active,
.filters button:hover {
  background: #00330a;
  color: white;
}

.social-masonry-grid {
  display: flex;
  margin-left: -20px;
  width: auto;
}

.social-masonry-column {
  padding-left: 20px;
  background-clip: padding-box;
}

.social-post-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 20px;
  box-shadow: 0 4px 6px rgba(0, 51, 10, 0.1);
  transition: transform 0.3s, box-shadow 0.3s;
  position: relative;
}

.social-post-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 12px rgba(0, 51, 10, 0.2);
}

.featured-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  background: #D4AF37;
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.85rem;
  z-index: 1;
}

.post-image img {
  width: 100%;
  height: auto;
  display: block;
}

.post-info {
  padding: 1rem;
}

.post-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.username {
  font-weight: 600;
  color: #00330a;
}

.caption {
  color: #666;
  font-size: 0.95rem;
  line-height: 1.4;
  margin: 0.5rem 0;
}

.post-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 0.75rem;
  font-size: 0.85rem;
  color: #999;
}

.live-indicator {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: #00330a;
  color: white;
  padding: 10px 20px;
  border-radius: 25px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.pulse {
  width: 8px;
  height: 8px;
  background: #4ade80;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(74, 222, 128, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(74, 222, 128, 0);
  }
}
```

---

## 🤖 n8n Automation Workflows

### Instagram Hashtag Monitor

```json
{
  "name": "Instagram Wedding Hashtag Monitor",
  "nodes": [
    {
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "parameters": {
        "rule": {
          "interval": [15],
          "unit": "minutes"
        }
      }
    },
    {
      "name": "Fetch Instagram Posts",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://walters-pierce-wedding.com/api/instagram/fetch-posts",
        "method": "GET"
      }
    },
    {
      "name": "Check New Posts",
      "type": "n8n-nodes-base.if",
      "parameters": {
        "conditions": {
          "number": [
            {
              "value1": "={{$json[\"count\"]}}",
              "operation": "larger",
              "value2": 0
            }
          ]
        }
      }
    },
    {
      "name": "Send Admin Notification",
      "type": "n8n-nodes-base.emailSend",
      "parameters": {
        "fromEmail": "wedding@walters-pierce.com",
        "toEmail": "admin@walters-pierce.com",
        "subject": "New Instagram Posts to Moderate",
        "text": "{{$json[\"count\"]}} new posts with #EmmeLovesCeeJay2026 need moderation.\n\nView them at: https://walters-pierce-wedding.com/admin/social-media"
      }
    }
  ]
}
```

---

## 📊 Admin Moderation Dashboard

```tsx
// app/admin/social-media/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Star } from 'lucide-react';

export default function SocialModerationDashboard() {
  const [pendingPosts, setPendingPosts] = useState([]);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0
  });
  
  const handleApprove = async (postId: string) => {
    await fetch(`/api/admin/social/approve`, {
      method: 'POST',
      body: JSON.stringify({ postId })
    });
    refreshPosts();
  };
  
  const handleReject = async (postId: string, reason?: string) => {
    await fetch(`/api/admin/social/reject`, {
      method: 'POST',
      body: JSON.stringify({ postId, reason })
    });
    refreshPosts();
  };
  
  const handleFeature = async (postId: string) => {
    await fetch(`/api/admin/social/feature`, {
      method: 'POST',
      body: JSON.stringify({ postId })
    });
    refreshPosts();
  };
  
  return (
    <div className="admin-dashboard">
      <h1>Social Media Moderation</h1>
      
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-number">{stats.pending}</span>
          <span className="stat-label">Pending</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{stats.approved}</span>
          <span className="stat-label">Approved</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{stats.rejected}</span>
          <span className="stat-label">Rejected</span>
        </div>
      </div>
      
      {/* Pending Posts Grid */}
      <div className="moderation-grid">
        {pendingPosts.map((post) => (
          <div key={post.id} className="moderation-card">
            <img src={post.media_url} alt={post.caption} />
            <div className="post-details">
              <p className="username">@{post.username}</p>
              <p className="caption">{post.caption}</p>
              <p className="timestamp">
                {new Date(post.posted_at).toLocaleString()}
              </p>
            </div>
            <div className="moderation-actions">
              <button 
                onClick={() => handleApprove(post.id)}
                className="btn-approve"
              >
                <CheckCircle /> Approve
              </button>
              <button 
                onClick={() => handleReject(post.id)}
                className="btn-reject"
              >
                <XCircle /> Reject
              </button>
              <button 
                onClick={() => handleFeature(post.id)}
                className="btn-feature"
              >
                <Star /> Feature
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 📱 QR Code Generation

```javascript
// lib/qr-code.js
import QRCode from 'qrcode';

export async function generateHashtagQR() {
  const data = {
    instagram: 'https://www.instagram.com/explore/tags/emmelovesceejay2026/',
    snapchat: 'https://www.snapchat.com/add/emmeandceejay',
    website: 'https://walters-pierce-wedding.com/social'
  };
  
  const qrCode = await QRCode.toDataURL(JSON.stringify(data), {
    width: 500,
    margin: 2,
    color: {
      dark: '#00330a',
      light: '#FFFFFF'
    }
  });
  
  return qrCode;
}
```

---

## 📋 Launch Checklist

### Pre-Wedding (3 months before)
- [ ] Create and test wedding hashtag
- [ ] Design Snapchat geofilter
- [ ] Submit geofilter for approval
- [ ] Set up Instagram API access
- [ ] Test social wall functionality
- [ ] Create QR codes
- [ ] Design and print table cards

### Pre-Wedding (1 month before)
- [ ] Train moderation team
- [ ] Test live display at venue
- [ ] Send hashtag info to guests
- [ ] Create photo challenge list
- [ ] Test all integrations

### Wedding Day
- [ ] Activate Snapchat geofilter
- [ ] Start social wall display
- [ ] Monitor moderation queue
- [ ] Ensure live updates working
- [ ] Capture backup of all posts

### Post-Wedding
- [ ] Download all social posts
- [ ] Create highlight reel
- [ ] Thank contributors
- [ ] Archive for album