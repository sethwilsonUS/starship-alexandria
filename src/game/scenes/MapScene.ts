import { Scene } from 'phaser';
import { useGameStore } from '@/store/gameStore';
import { speak, cancelSpeech } from '@/utils/speech';
import { MAP_WIDTH, MAP_HEIGHT } from '@/config/gameConfig';
import type { MapRoom } from '@/types/store';

function isInAnyRoom(rooms: MapRoom[], x: number, y: number): boolean {
  return rooms.some(r => x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2);
}

function getDirectionLabel(room: MapRoom): string {
  const cx = (room.x1 + room.x2) / 2;
  const cy = (room.y1 + room.y2) / 2;
  
  const thirdX = MAP_WIDTH / 3;
  const thirdY = MAP_HEIGHT / 3;
  
  let ns = '';
  let ew = '';
  
  if (cy < thirdY) ns = 'north';
  else if (cy > thirdY * 2) ns = 'south';
  
  if (cx < thirdX) ew = 'west';
  else if (cx > thirdX * 2) ew = 'east';
  
  if (ns && ew) return `${ns}${ew}`;
  if (ns) return ns;
  if (ew) return ew;
  return 'center';
}

function getRoomContainingPoint(rooms: MapRoom[], x: number, y: number): MapRoom | null {
  return rooms.find(r => x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2) ?? null;
}

interface NpcOnMap {
  id: string;
  name: string;
  x: number;
  y: number;
  roomName: string;
}

export default class MapScene extends Scene {
  private rooms: MapRoom[] = [];
  private sortedRooms: MapRoom[] = [];
  private selectedIndex: number = -1;
  private playerRoom: MapRoom | null = null;
  private roomGraphics: Phaser.GameObjects.Graphics[] = [];
  private roomTexts: Phaser.GameObjects.Text[] = [];
  private keyboardEnabled = false;
  private mapScale = 1;
  private mapOffsetX = 0;
  private mapOffsetY = 0;
  private discoveredNpcs: NpcOnMap[] = [];
  
  constructor() {
    super({ key: 'MapScene' });
  }
  
  create() {
    const { mapRooms, mapSpawn, mapWalls, npcPositionsOnMap } = useGameStore.getState().session;
    const { discoveredNPCs } = useGameStore.getState().exploration;
    const playerPos = useGameStore.getState().player.position;
    
    this.rooms = mapRooms;
    this.playerRoom = getRoomContainingPoint(mapRooms, playerPos.x, playerPos.y);
    
    // Filter NPCs to only show discovered ones
    const discoveredSet = new Set(discoveredNPCs);
    this.discoveredNpcs = npcPositionsOnMap.filter(npc => discoveredSet.has(npc.id));
    
    // Sort rooms top-to-bottom, left-to-right for navigation
    this.sortedRooms = [...mapRooms].sort((a, b) => {
      const aY = (a.y1 + a.y2) / 2;
      const bY = (b.y1 + b.y2) / 2;
      if (Math.abs(aY - bY) > 3) return aY - bY;
      return (a.x1 + a.x2) / 2 - (b.x1 + b.x2) / 2;
    });
    
    // Dark background
    this.cameras.main.setBackgroundColor(0x0a0a0f);
    
    // Calculate scale to fit screen - use most of the available space
    const headerHeight = 70;
    const footerHeight = 40;
    const sidePadding = 30;
    const availableWidth = this.cameras.main.width - sidePadding * 2;
    const availableHeight = this.cameras.main.height - headerHeight - footerHeight;
    this.mapScale = Math.min(availableWidth / MAP_WIDTH, availableHeight / MAP_HEIGHT) * 0.95;
    
    // Center the map in the available space
    const mapPixelWidth = MAP_WIDTH * this.mapScale;
    const mapPixelHeight = MAP_HEIGHT * this.mapScale;
    this.mapOffsetX = (this.cameras.main.width - mapPixelWidth) / 2;
    this.mapOffsetY = headerHeight + (availableHeight - mapPixelHeight) / 2;
    
    // Title
    this.add.text(this.cameras.main.width / 2, 22, 'Area Map', {
      fontSize: '28px',
      fontFamily: 'sans-serif',
      color: '#ffffff',
    }).setOrigin(0.5);
    
    // Instructions
    this.add.text(this.cameras.main.width / 2, 50, '↑↓ or ←→ to navigate rooms • Escape or M to close', {
      fontSize: '14px',
      fontFamily: 'sans-serif',
      color: '#888888',
    }).setOrigin(0.5);
    
    // Draw corridors (walkable tiles not in rooms)
    if (mapWalls && mapWalls.length > 0) {
      const corridorGraphics = this.add.graphics();
      corridorGraphics.fillStyle(0x555566, 0.6);
      
      for (let y = 0; y < mapWalls.length; y++) {
        for (let x = 0; x < (mapWalls[y]?.length ?? 0); x++) {
          const isWall = mapWalls[y][x] !== 0;
          if (isWall) continue;
          if (isInAnyRoom(mapRooms, x, y)) continue;
          
          const px = this.mapOffsetX + x * this.mapScale;
          const py = this.mapOffsetY + y * this.mapScale;
          const size = Math.max(2, this.mapScale * 0.8);
          corridorGraphics.fillRect(px, py, size, size);
        }
      }
    }
    
    // Draw each room
    this.sortedRooms.forEach((room, idx) => {
      const x = this.mapOffsetX + room.x1 * this.mapScale;
      const y = this.mapOffsetY + room.y1 * this.mapScale;
      const w = (room.x2 - room.x1 + 1) * this.mapScale;
      const h = (room.y2 - room.y1 + 1) * this.mapScale;

      const isPlayerRoom = room === this.playerRoom;

      // Room rectangle
      const graphics = this.add.graphics();
      this.roomGraphics.push(graphics);

      this.drawRoom(graphics, x, y, w, h, false, isPlayerRoom);

      // Room name
      const fontSize = Math.max(12, Math.min(18, Math.min(w, h) / 4));
      const text = this.add.text(x + w / 2, y + h / 2, room.name, {
        fontSize: `${fontSize}px`,
        fontFamily: 'sans-serif',
        color: isPlayerRoom ? '#7fff7f' : '#cccccc',
        align: 'center',
        wordWrap: { width: w - 8 },
      }).setOrigin(0.5);
      this.roomTexts.push(text);
      
      // Player indicator
      if (isPlayerRoom) {
        const starY = y + h / 2 + fontSize / 2 + 8;
        if (starY < y + h - 5) {
          this.add.text(x + w / 2, starY, '★ YOU', {
            fontSize: '12px',
            fontFamily: 'sans-serif',
            color: '#ffd700',
          }).setOrigin(0.5);
        }
      }
    });
    
    // Draw discovered NPCs
    this.discoveredNpcs.forEach(npc => {
      const npcX = this.mapOffsetX + npc.x * this.mapScale;
      const npcY = this.mapOffsetY + npc.y * this.mapScale;
      
      // NPC marker - amber circle with person icon
      const npcMarker = this.add.graphics();
      npcMarker.fillStyle(0xe8a838, 1);
      npcMarker.fillCircle(npcX, npcY, 8);
      npcMarker.lineStyle(2, 0xffffff, 1);
      npcMarker.strokeCircle(npcX, npcY, 8);
      
      // NPC name label
      this.add.text(npcX, npcY + 14, npc.name, {
        fontSize: '11px',
        fontFamily: 'sans-serif',
        color: '#e8a838',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5, 0);
    });
    
    // Legend at bottom
    const legendY = this.cameras.main.height - 20;
    const hasNpcs = this.discoveredNpcs.length > 0;
    const legendSpacing = hasNpcs ? 120 : 90;
    
    this.add.text(this.cameras.main.width / 2 - legendSpacing, legendY, '■ Selected', {
      fontSize: '13px',
      color: '#00ced1',
    }).setOrigin(0.5);
    this.add.text(this.cameras.main.width / 2, legendY, '■ You are here', {
      fontSize: '13px',
      color: '#5cb85c',
    }).setOrigin(0.5);
    if (hasNpcs) {
      this.add.text(this.cameras.main.width / 2 + legendSpacing, legendY, '● NPC', {
        fontSize: '13px',
        color: '#e8a838',
      }).setOrigin(0.5);
    }
    
    // Keyboard input (delayed to prevent instant close)
    this.time.delayedCall(300, () => {
      this.keyboardEnabled = true;
    });
    
    this.input.keyboard!.on('keydown', this.handleKeyDown, this);
    
    // TTS intro
    const playerRoomName = this.playerRoom?.name ?? 'a corridor';
    const npcCount = this.discoveredNpcs.length;
    const npcNote = npcCount > 0 
      ? ` ${npcCount} survivor${npcCount > 1 ? 's' : ''} discovered.`
      : '';
    const intro = `Map of the area. ${this.rooms.length} rooms.${npcNote} You are in ${playerRoomName}. Use arrow keys to navigate between rooms. Press Escape or M to close.`;
    speak(intro);
  }
  
  private drawRoom(
    graphics: Phaser.GameObjects.Graphics,
    x: number, y: number, w: number, h: number,
    isSelected: boolean,
    isPlayerRoom: boolean
  ) {
    graphics.clear();
    
    if (isSelected) {
      // Selected: cyan with glow
      graphics.fillStyle(0x00ced1, 0.4);
      graphics.fillRoundedRect(x, y, w, h, 6);
      graphics.lineStyle(3, 0x00ced1, 1);
      graphics.strokeRoundedRect(x, y, w, h, 6);
    } else if (isPlayerRoom) {
      // Player room: green
      graphics.fillStyle(0x5cb85c, 0.35);
      graphics.fillRoundedRect(x, y, w, h, 6);
      graphics.lineStyle(3, 0x5cb85c, 1);
      graphics.strokeRoundedRect(x, y, w, h, 6);
    } else {
      // Normal room: gray
      graphics.fillStyle(0x404050, 0.6);
      graphics.fillRoundedRect(x, y, w, h, 6);
      graphics.lineStyle(2, 0x555555, 1);
      graphics.strokeRoundedRect(x, y, w, h, 6);
    }
  }
  
  private handleKeyDown = (event: KeyboardEvent) => {
    if (!this.keyboardEnabled) return;
    
    if (event.code === 'Escape' || event.code === 'KeyM') {
      event.preventDefault();
      this.closeMap();
      return;
    }
    
    if (event.code === 'ArrowDown' || event.code === 'ArrowRight') {
      event.preventDefault();
      this.navigateRoom(1);
    } else if (event.code === 'ArrowUp' || event.code === 'ArrowLeft') {
      event.preventDefault();
      this.navigateRoom(-1);
    }
  };
  
  private navigateRoom(direction: number) {
    const count = this.sortedRooms.length;
    if (count === 0) return;
    
    if (this.selectedIndex === -1) {
      this.selectedIndex = direction > 0 ? 0 : count - 1;
    } else {
      this.selectedIndex = (this.selectedIndex + direction + count) % count;
    }
    
    this.updateSelection();
    this.speakCurrentRoom();
  }
  
  private updateSelection() {
    this.sortedRooms.forEach((room, idx) => {
      const x = this.mapOffsetX + room.x1 * this.mapScale;
      const y = this.mapOffsetY + room.y1 * this.mapScale;
      const w = (room.x2 - room.x1 + 1) * this.mapScale;
      const h = (room.y2 - room.y1 + 1) * this.mapScale;
      
      const isSelected = idx === this.selectedIndex;
      const isPlayerRoom = room === this.playerRoom;
      
      this.drawRoom(this.roomGraphics[idx], x, y, w, h, isSelected, isPlayerRoom);
      
      // Update text color
      if (isSelected) {
        this.roomTexts[idx].setColor('#00ced1');
      } else if (isPlayerRoom) {
        this.roomTexts[idx].setColor('#7fff7f');
      } else {
        this.roomTexts[idx].setColor('#cccccc');
      }
    });
  }
  
  private speakCurrentRoom() {
    const room = this.sortedRooms[this.selectedIndex];
    if (!room) return;

    const direction = getDirectionLabel(room);
    const isPlayerHere = room === this.playerRoom;
    
    // Check for NPCs in this room
    const npcsInRoom = this.discoveredNpcs.filter(npc => npc.roomName === room.name);
    
    let text = `${room.name}. ${direction} side of the map.`;
    if (npcsInRoom.length > 0) {
      const npcNames = npcsInRoom.map(n => n.name).join(' and ');
      text += ` ${npcNames} is here.`;
    }
    if (isPlayerHere) {
      text += ' You are here.';
    }
    speak(text);
  }
  
  private closeMap() {
    cancelSpeech();
    this.input.keyboard!.off('keydown', this.handleKeyDown, this);
    useGameStore.getState().actions.closeMap();
    this.scene.stop('MapScene');
    this.scene.wake('ExploreScene');
  }
}
