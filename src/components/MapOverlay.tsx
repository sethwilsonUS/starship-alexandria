'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import { speak, cancelSpeech } from '@/utils/speech';
import { MAP_WIDTH, MAP_HEIGHT } from '@/config/gameConfig';
import type { MapRoom } from '@/types/store';

function getDirectionLabel(room: MapRoom, mapWidth: number, mapHeight: number): string {
  const cx = (room.x1 + room.x2) / 2;
  const cy = (room.y1 + room.y2) / 2;
  
  const thirdX = mapWidth / 3;
  const thirdY = mapHeight / 3;
  
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

function getRoomIcon(roomName: string): string {
  const name = roomName.toLowerCase();
  if (name.includes('archive') || name.includes('records')) return '📜';
  if (name.includes('reading')) return '📖';
  if (name.includes('study')) return '✒️';
  if (name.includes('vault') || name.includes('treasury')) return '🔒';
  if (name.includes('gallery')) return '🖼️';
  if (name.includes('hall') || name.includes('atrium')) return '🏛️';
  if (name.includes('storage') || name.includes('depot')) return '📦';
  if (name.includes('office') || name.includes('chamber')) return '🪑';
  return '📍';
}

export default function MapOverlay() {
  const gamePhase = useGameStore((s) => s.session.gamePhase);
  const mapRooms = useGameStore((s) => s.session.mapRooms);
  const playerPosition = useGameStore((s) => s.player.position);
  const mapSpawn = useGameStore((s) => s.session.mapSpawn);
  const npcPositions = useGameStore((s) => s.session.npcPositionsOnMap);
  const closeMap = useGameStore((s) => s.actions.closeMap);
  
  const [selectedRoomIndex, setSelectedRoomIndex] = useState<number | null>(null);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const openedAtRef = useRef<number>(0);
  const isOpen = gamePhase === 'viewing-map';
  
  const sortedRooms = useRef<MapRoom[]>([]);
  
  useEffect(() => {
    if (isOpen && mapRooms.length > 0) {
      sortedRooms.current = [...mapRooms].sort((a, b) => {
        const aY = (a.y1 + a.y2) / 2;
        const bY = (b.y1 + b.y2) / 2;
        if (Math.abs(aY - bY) > 3) return aY - bY;
        return (a.x1 + a.x2) / 2 - (b.x1 + b.x2) / 2;
      });
    }
  }, [isOpen, mapRooms]);
  
  // Animate in when opening
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Trigger animation on next frame
      requestAnimationFrame(() => {
        setIsAnimatingIn(true);
      });
      openedAtRef.current = Date.now();
      setSelectedRoomIndex(null);
      
      const playerRoom = getRoomContainingPoint(mapRooms, playerPosition.x, playerPosition.y);
      const playerRoomName = playerRoom ? playerRoom.name : 'a corridor';
      const intro = `Map of the area. ${mapRooms.length} rooms. You are in ${playerRoomName}. Use arrow keys to navigate between rooms. Press Escape or M to close.`;
      speak(intro);
    } else {
      setIsAnimatingIn(false);
      // Delay hiding to allow animation out
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
    return () => {
      if (isOpen) {
        cancelSpeech();
      }
    };
  }, [isOpen, mapRooms, playerPosition.x, playerPosition.y]);
  
  const speakRoom = useCallback((index: number) => {
    const room = sortedRooms.current[index];
    if (!room) return;
    
    const direction = getDirectionLabel(room, MAP_WIDTH, MAP_HEIGHT);
    const playerRoom = getRoomContainingPoint(sortedRooms.current, playerPosition.x, playerPosition.y);
    const isPlayerHere = playerRoom === room;
    const suffix = isPlayerHere ? ' You are here.' : '';
    const text = `${room.name}. ${direction} side of the map.${suffix}`;
    speak(text);
  }, [playerPosition.x, playerPosition.y]);
  
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      
      if (Date.now() - openedAtRef.current < 300) return;
      
      if (e.code === 'Escape' || e.code === 'KeyM') {
        e.preventDefault();
        cancelSpeech();
        closeMap();
        return;
      }
      
      const roomCount = sortedRooms.current.length;
      if (roomCount === 0) return;
      
      if (e.code === 'ArrowDown' || e.code === 'ArrowRight') {
        e.preventDefault();
        setSelectedRoomIndex(prev => {
          const next = prev === null ? 0 : (prev + 1) % roomCount;
          speakRoom(next);
          return next;
        });
      } else if (e.code === 'ArrowUp' || e.code === 'ArrowLeft') {
        e.preventDefault();
        setSelectedRoomIndex(prev => {
          const next = prev === null ? roomCount - 1 : (prev - 1 + roomCount) % roomCount;
          speakRoom(next);
          return next;
        });
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeMap, speakRoom]);
  
  if (!isVisible) return null;
  
  const rooms = sortedRooms.current.length > 0 ? sortedRooms.current : mapRooms;
  const playerRoom = getRoomContainingPoint(rooms, playerPosition.x, playerPosition.y);
  
  // Calculate bounding box of all rooms for better scaling
  const bounds = rooms.reduce(
    (acc, room) => ({
      minX: Math.min(acc.minX, room.x1),
      minY: Math.min(acc.minY, room.y1),
      maxX: Math.max(acc.maxX, room.x2),
      maxY: Math.max(acc.maxY, room.y2),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
  
  // Add padding around bounds
  const padding = 3;
  bounds.minX = Math.max(0, bounds.minX - padding);
  bounds.minY = Math.max(0, bounds.minY - padding);
  bounds.maxX = Math.min(MAP_WIDTH, bounds.maxX + padding);
  bounds.maxY = Math.min(MAP_HEIGHT, bounds.maxY + padding);
  
  const boundsWidth = bounds.maxX - bounds.minX;
  const boundsHeight = bounds.maxY - bounds.minY;
  
  // Convert coordinates relative to bounds
  const toPercent = (val: number, min: number, range: number) => ((val - min) / range) * 100;
  
  return (
    <div
      className="map-overlay"
      style={{
        opacity: isAnimatingIn ? 1 : 0,
        transform: isAnimatingIn ? 'scale(1)' : 'scale(0.95)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Area map"
    >
      {/* Parchment-style container */}
      <div className="map-overlay__parchment">
        {/* Header with decorative elements */}
        <div className="map-overlay__header">
          <div className="map-overlay__header-decor">✦</div>
          <div>
            <h2 className="map-overlay__title">Area Map</h2>
            <p className="map-overlay__subtitle">Ruins of the Old Library</p>
          </div>
          <div className="map-overlay__header-decor">✦</div>
        </div>
        
        {/* Map container */}
        <div className="map-overlay__map-area">
          <div 
            className="map-overlay__map"
            aria-hidden="true"
          >
            {/* Decorative compass rose in corner */}
            <div className="map-overlay__compass">
              <span className="map-overlay__compass-n">N</span>
              <span className="map-overlay__compass-rose">✧</span>
            </div>
            
            {rooms.map((room, idx) => {
              const isSelected = selectedRoomIndex === idx;
              const isPlayerRoom = room === playerRoom;
              
              const leftPct = toPercent(room.x1, bounds.minX, boundsWidth);
              const topPct = toPercent(room.y1, bounds.minY, boundsHeight);
              const widthPct = ((room.x2 - room.x1 + 1) / boundsWidth) * 100;
              const heightPct = ((room.y2 - room.y1 + 1) / boundsHeight) * 100;
              
              const roomIcon = getRoomIcon(room.name);
              
              return (
                <div
                  key={room.name + idx}
                  className={`map-overlay__room ${isSelected ? 'map-overlay__room--selected' : ''} ${isPlayerRoom ? 'map-overlay__room--player' : ''}`}
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: `${widthPct}%`,
                    height: `${heightPct}%`,
                    animationDelay: `${idx * 50}ms`,
                  }}
                >
                  <span className="map-overlay__room-icon">{roomIcon}</span>
                  <span className="map-overlay__room-name">{room.name}</span>
                  {isPlayerRoom && (
                    <span className="map-overlay__player-marker">
                      <span className="map-overlay__player-dot"></span>
                      <span className="map-overlay__player-label">YOU</span>
                    </span>
                  )}
                </div>
              );
            })}
            
            {/* Transporter beam marker */}
            {mapSpawn && (
              <div
                className="map-overlay__poi map-overlay__poi--transporter"
                style={{
                  left: `${toPercent(mapSpawn.x, bounds.minX, boundsWidth)}%`,
                  top: `${toPercent(mapSpawn.y, bounds.minY, boundsHeight)}%`,
                }}
                title="Transporter Beam"
              >
                <span className="map-overlay__poi-icon">🔵</span>
              </div>
            )}
            
            {/* NPC markers */}
            {npcPositions.map((npc) => (
              <div
                key={npc.id}
                className="map-overlay__poi map-overlay__poi--npc"
                style={{
                  left: `${toPercent(npc.x, bounds.minX, boundsWidth)}%`,
                  top: `${toPercent(npc.y, bounds.minY, boundsHeight)}%`,
                }}
                title={npc.name}
              >
                <span className="map-overlay__poi-icon">👤</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Instructions */}
        <p className="map-overlay__instructions">
          ↑↓ or ←→ to navigate rooms • Escape or M to close
        </p>
        
        {/* Footer legend */}
        <div className="map-overlay__legend">
          <div className="map-overlay__legend-item">
            <span className="map-overlay__legend-swatch map-overlay__legend-swatch--player"></span>
            <span>You are here</span>
          </div>
          <div className="map-overlay__legend-item">
            <span className="map-overlay__legend-icon">🔵</span>
            <span>Transporter</span>
          </div>
          {npcPositions.length > 0 && (
            <div className="map-overlay__legend-item">
              <span className="map-overlay__legend-icon">👤</span>
              <span>Survivor</span>
            </div>
          )}
          <div className="map-overlay__legend-item">
            <span className="map-overlay__legend-swatch map-overlay__legend-swatch--selected"></span>
            <span>Selected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
