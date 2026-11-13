// Versioned prompt-generation registry. This describes output requirements only;
// it does not publish, authenticate, or call any platform API.
export const PLATFORM_REGISTRY_VERSION = '2026-10-25';

export const PLATFORM_REGISTRY = {
  instagram: {
    id: 'instagram', name: 'Instagram', aliases: ['instagram', 'ig'], defaultSurface: 'feed',
    surfaces: {
      feed: { id: 'feed', label: 'Feed post', assetTypes: ['copy', 'image'], format: '4:5 or 1:1', guidance: 'Lead with a clear visual hook and a concise caption.' },
      reel: { id: 'reel', label: 'Reel', assetTypes: ['script', 'video', 'copy'], format: '9:16 vertical video', guidance: 'Write a fast hook, beat-by-beat sequence, on-screen text guidance, and caption.' },
      story: { id: 'story', label: 'Story', assetTypes: ['copy', 'image', 'video'], format: '9:16 vertical frame or clip', guidance: 'Use one focused message and a clear interaction or next step.' }
    }
  },
  tiktok: {
    id: 'tiktok', name: 'TikTok', aliases: ['tiktok', 'tik tok'], defaultSurface: 'video',
    surfaces: { video: { id: 'video', label: 'Video', assetTypes: ['script', 'video', 'copy'], format: '9:16 vertical video', guidance: 'Create an immediate hook, short beats, creator direction, and caption.' } }
  },
  youtube: {
    id: 'youtube', name: 'YouTube', aliases: ['youtube', 'yt'], defaultSurface: 'short',
    surfaces: {
      short: { id: 'short', label: 'Short', assetTypes: ['script', 'video', 'copy'], format: '9:16 vertical short-form video', guidance: 'Supply title, hook, beat outline, description, and thumbnail direction.' },
      video: { id: 'video', label: 'Long-form video', assetTypes: ['script', 'video', 'copy'], format: '16:9 video', guidance: 'Supply title, opening, chapter outline, description, and thumbnail direction.' }
    }
  },
  facebook: {
    id: 'facebook', name: 'Facebook', aliases: ['facebook', 'fb'], defaultSurface: 'feed',
    surfaces: {
      feed: { id: 'feed', label: 'Feed post', assetTypes: ['copy', 'image', 'video'], format: '1:1 or 4:5 image; optional video', guidance: 'Use accessible context, a clear message, and a practical CTA.' },
      reel: { id: 'reel', label: 'Reel', assetTypes: ['script', 'video', 'copy'], format: '9:16 vertical video', guidance: 'Use a concise hook and clear spoken/on-screen direction.' }
    }
  },
  linkedin: {
    id: 'linkedin', name: 'LinkedIn', aliases: ['linkedin', 'linked in'], defaultSurface: 'post',
    surfaces: {
      post: { id: 'post', label: 'Post', assetTypes: ['copy', 'image', 'video', 'document'], format: 'Text, image, video, or document post', guidance: 'Use professional context, specific value, and an evidence-safe CTA.' },
      video: { id: 'video', label: 'Video post', assetTypes: ['script', 'video', 'copy'], format: 'Native professional video', guidance: 'Use a clear insight, speaker direction, and supporting caption.' }
    }
  },
  twitch: {
    id: 'twitch', name: 'Twitch', aliases: ['twitch'], defaultSurface: 'stream',
    surfaces: { stream: { id: 'stream', label: 'Livestream', assetTypes: ['copy', 'script', 'image'], format: 'Stream title, panels, segments, and clip ideas', guidance: 'Plan live segments, chat prompts, moderation notes, and clip moments.' } }
  },
  discord: {
    id: 'discord', name: 'Discord', aliases: ['discord'], defaultSurface: 'announcement',
    surfaces: { announcement: { id: 'announcement', label: 'Announcement', assetTypes: ['copy', 'image'], format: 'Community announcement', guidance: 'Make the action, timing, channel, and moderation expectations explicit.' } }
  },
  pinterest: {
    id: 'pinterest', name: 'Pinterest', aliases: ['pinterest'], defaultSurface: 'pin',
    surfaces: { pin: { id: 'pin', label: 'Pin', assetTypes: ['copy', 'image'], format: 'Vertical pin', guidance: 'Use searchable language, a specific promise, and an image concept.' } }
  },
  x: {
    id: 'x', name: 'X', aliases: ['x', 'twitter'], defaultSurface: 'post',
    surfaces: { post: { id: 'post', label: 'Post', assetTypes: ['copy', 'image', 'video'], format: 'Short text post or media post', guidance: 'Lead with one clear point and avoid unsupported certainty.' } }
  }
};

const surfaceAliases = new Map([
  ['feed', 'feed'], ['post', 'post'], ['reel', 'reel'], ['reels', 'reel'], ['story', 'story'], ['stories', 'story'],
  ['video', 'video'], ['short', 'short'], ['shorts', 'short'], ['stream', 'stream'], ['announcement', 'announcement'], ['pin', 'pin']
]);
const surfaceWords = { reel: ['reel', 'reels'], story: ['story', 'stories'], feed: ['feed'], post: ['post'], video: ['video'], short: ['short', 'shorts'], stream: ['stream'], announcement: ['announcement'], pin: ['pin'] };

function clean(value) { return value.toLowerCase().replace(/[()[\]]/g, ' ').replace(/\s+/g, ' ').trim(); }
function hasWord(text, value) { const pattern = value.split(/\s+/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'); return new RegExp(`\\b${pattern}\\b`, 'i').test(text); }

function target(platform, surface) {
  const definition = PLATFORM_REGISTRY[platform];
  const selected = definition.surfaces[surface] || definition.surfaces[definition.defaultSurface];
  return {
    id: `${platform}:${selected.id}`,
    platform: definition.id,
    platformName: definition.name,
    surface: selected.id,
    surfaceName: selected.label,
    assetTypes: selected.assetTypes,
    format: selected.format,
    guidance: selected.guidance,
    acceptanceCriteria: [
      `Names ${definition.name} / ${selected.label}.`,
      `Uses the required format: ${selected.format}.`,
      `Accounts for these asset types: ${selected.assetTypes.join(', ')}.`,
      `Follows platform guidance: ${selected.guidance}`
    ],
    registryVersion: PLATFORM_REGISTRY_VERSION
  };
}

export function normalizePlatformTargets(value) {
  if (Array.isArray(value)) return value.flatMap(item => normalizePlatformTargets(typeof item === 'string' ? item : `${item.platform || ''} ${item.surface || ''}`));
  const raw = String(value || '').trim();
  if (!raw) return [];
  const text = clean(raw);
  const found = [];
  for (const definition of Object.values(PLATFORM_REGISTRY)) {
    if (!definition.aliases.some(alias => hasWord(text, alias))) continue;
    const matchingSurfaces = Object.keys(definition.surfaces).filter(surface => (surfaceWords[surface] || [surface]).some(word => hasWord(text, word)));
    (matchingSurfaces.length ? matchingSurfaces : [definition.defaultSurface]).forEach(surface => found.push(target(definition.id, surface)));
  }
  const targets = [...new Map(found.map(item => [item.id, item])).values()];
  return targets.length ? targets : [{ id: `custom:${text}`, platform: 'custom', platformName: raw, surface: 'default', surfaceName: 'Requested format', assetTypes: ['copy', 'image', 'video', 'script'], format: 'Confirm platform format', guidance: 'Ask the human to confirm the platform and output format before production.', acceptanceCriteria: ['Human confirms the platform and requested format before production.'], registryVersion: PLATFORM_REGISTRY_VERSION }];
}

export function platformTargetSummary(targets) {
  return targets.map(item => `${item.platformName} / ${item.surfaceName} (${item.format})`).join('; ');
}
