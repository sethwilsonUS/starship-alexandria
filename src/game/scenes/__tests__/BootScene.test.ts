import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  Scene: class {
    constructor(_config?: unknown) {}
  },
}));

import { ASSET_KEYS } from '@/game/assets/assetManifest';
import { useGameStore } from '@/store/gameStore';
import BootScene from '../BootScene';

type LoaderCallback = (value?: { key: string; src?: string }) => void;

function createBootHarness(
  failedAssetKey: string,
  failedAssetType: 'image' | 'audio' = 'image',
) {
  const loadedTextures = new Set<string>();
  const loadedAudio = new Set<string>();
  const onceCallbacks = new Map<string, LoaderCallback>();
  const eventCallbacks = new Map<string, LoaderCallback>();
  const graphics = {
    fillStyle: vi.fn(),
    fillRect: vi.fn(),
    generateTexture: vi.fn((key: string) => loadedTextures.add(key)),
    destroy: vi.fn(),
  };
  const load = {
    image: vi.fn((key: string) => {
      if (failedAssetType !== 'image' || key !== failedAssetKey) loadedTextures.add(key);
    }),
    audio: vi.fn((key: string) => {
      if (failedAssetType !== 'audio' || key !== failedAssetKey) loadedAudio.add(key);
    }),
    once: vi.fn((event: string, callback: LoaderCallback) => onceCallbacks.set(event, callback)),
    on: vi.fn((event: string, callback: LoaderCallback) => eventCallbacks.set(event, callback)),
  };
  const sceneStart = vi.fn();
  const bootScene = new BootScene();
  Object.assign(bootScene, {
    load,
    textures: { exists: (key: string) => loadedTextures.has(key) },
    cache: { audio: { exists: (key: string) => loadedAudio.has(key) } },
    add: { graphics: vi.fn(() => graphics) },
    scene: { manager: {}, start: sceneStart },
  });

  bootScene.preload();
  eventCallbacks.get('loaderror')?.({ key: failedAssetKey });
  onceCallbacks.get('complete')?.();

  return { bootScene, sceneStart };
}

describe('BootScene loading lifecycle', () => {
  it('continues to content loading when a failed image has a generated fallback', async () => {
    const originalSession = useGameStore.getState().session;
    const fetchMock = vi.fn().mockRejectedValue(new Error('content unavailable'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', fetchMock);
    const { bootScene } = createBootHarness(ASSET_KEYS.tilesets.cathedral);

    await bootScene.create();
    const fetchCallCount = fetchMock.mock.calls.length;

    vi.unstubAllGlobals();
    consoleError.mockRestore();
    useGameStore.setState({ session: originalSession });

    expect(fetchCallCount).toBeGreaterThan(0);
  });

  it('keeps content loading blocked when a failed asset has no fallback', async () => {
    const originalSession = useGameStore.getState().session;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const failedAudioKey = ASSET_KEYS.audio.ambience.ship;
    const { bootScene } = createBootHarness(failedAudioKey, 'audio');

    await bootScene.create();
    const fetchCallCount = fetchMock.mock.calls.length;

    vi.unstubAllGlobals();
    useGameStore.setState({ session: originalSession });

    expect(fetchCallCount).toBe(0);
  });

  it('does not start a playable scene when content loading fails', async () => {
    const originalSession = useGameStore.getState().session;
    const fetchMock = vi.fn().mockRejectedValue(new Error('content unavailable'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const sceneStart = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const bootScene = new BootScene();
    Object.assign(bootScene, { scene: { manager: {}, start: sceneStart } });

    await bootScene.create();
    const startCallCount = sceneStart.mock.calls.length;

    vi.unstubAllGlobals();
    consoleError.mockRestore();
    useGameStore.setState({ session: originalSession });

    expect(startCallCount).toBe(0);
  });
});
