import { describe, it, expect } from 'vitest';
import { yamlToNPC } from '../npcs';
import type { NPCYaml } from '@/utils/contentLoader';

const sampleNPCYaml: NPCYaml = {
  id: 'martha',
  name: 'Martha',
  firstMeet: [
    { speaker: 'Martha', text: 'Oh! A visitor from the sky.' },
    { text: 'She adjusts her glasses.' },
    { speaker: 'Martha', text: 'Are you looking for books too?' },
  ],
  return: [
    { speaker: 'Martha', text: 'Welcome back, dear.' },
  ],
};

describe('yamlToNPC', () => {
  it('maps id and name from YAML', () => {
    const npc = yamlToNPC(sampleNPCYaml);
    expect(npc.id).toBe('martha');
    expect(npc.name).toBe('Martha');
  });

  it('converts firstMeet dialogue lines preserving speaker and text', () => {
    const npc = yamlToNPC(sampleNPCYaml);
    expect(npc.firstMeet).toHaveLength(3);
    expect(npc.firstMeet[0]).toEqual({ speaker: 'Martha', text: 'Oh! A visitor from the sky.' });
  });

  it('handles lines without a speaker (narration)', () => {
    const npc = yamlToNPC(sampleNPCYaml);
    expect(npc.firstMeet[1].speaker).toBeUndefined();
    expect(npc.firstMeet[1].text).toBe('She adjusts her glasses.');
  });

  it('converts return dialogue lines', () => {
    const npc = yamlToNPC(sampleNPCYaml);
    expect(npc.return).toHaveLength(1);
    expect(npc.return[0]).toEqual({ speaker: 'Martha', text: 'Welcome back, dear.' });
  });

  it('handles empty dialogue arrays', () => {
    const minimal: NPCYaml = {
      id: 'ghost',
      name: 'Ghost',
      firstMeet: [],
      return: [],
    };
    const npc = yamlToNPC(minimal);
    expect(npc.firstMeet).toEqual([]);
    expect(npc.return).toEqual([]);
  });
});
