import {coastalNuclearWorld,styleCoastalBuildings} from './coastalNuclearWorld.js';
import { buildingWallObstacles } from './collision.ts';

export interface WorldObstacle {id:string;x:number;z:number;w:number;d:number;h:number;kind:string;rotation:number;color?:string;bulletPassable?:boolean;}
export interface WorldLootSpawn {id:string;x:number;z:number;pool:string;tier:number;buildingId?:string;accessDoorId?:string;containerKind?:'crate'|'locker'|'case';searchSeconds?:number;}
export type AccessDoorColor='yellow'|'red'|'black';
export interface WorldAccessDoor {id:string;buildingId:string;name:string;color:AccessDoorColor;itemId:'password-letter-yellow'|'password-letter-red'|'password-letter-black';x:number;z:number;w:number;d:number;h:number;rotation:0;}
export interface WorldEnemySpawn {id:string;x:number;z:number;kind:string;radius:number;}
export interface WorldExtraction {id:string;name:string;x:number;z:number;radius:number;kind:'fixed'|'helicopter';holdSeconds:number;}
export interface WorldLandmark {id:string;name:string;x:number;z:number;kind:string;}
export interface WorldTerrain {id:string;kind:'reservoir'|'river'|'field'|'yard';x:number;z:number;w:number;d:number;}
export type BuildingDoorSide='north'|'south'|'east'|'west';
export type WorldBuildingKind='hut'|'armory'|'generator'|'office'|'support-center'|'barracks'|'hydro'|'market'|'workshop'|'bunker';
export interface WorldBuilding {id:string;sourceKind:WorldBuildingKind;name:string;x:number;z:number;w:number;d:number;shape:'rect';wallHeight:number;wallThickness:number;wallColor:string;floor:{color:string;markings?:string};roof:{style:'cutaway';color:string;overhang:number;occluder:true};door:{side:BuildingDoorSide;offset:number;width:number};occlusion:{fadeWalls:true;fadeRoof:true;keepFloor:true};}
export interface WorldDef {id:string;name:string;size:number;spawn:{x:number;z:number};obstacles:WorldObstacle[];lootSpawns:WorldLootSpawn[];accessDoors:WorldAccessDoor[];enemySpawns:WorldEnemySpawn[];extractions:WorldExtraction[];landmarks:WorldLandmark[];radiationZones:RadiationZone[];roads:{x:number;z:number;w:number;d:number}[];terrain?:WorldTerrain[];buildings?:WorldBuilding[];}
export interface RadiationZone {id:string;name:string;x:number;z:number;radius:number;w?:number;d?:number;shape?:'rect'|'circle';hpPerSecond:number;maxHpPerSecond:number;minMaxHp:number;}
// Fixed, authored district layout. Building dimensions stay human-scale as travel distances grow.
export const WORLD:WorldDef = {
  "id": "arctic-base",
  "name": "아틱 베이스",
  "size": 480,
  "spawn": {
    "x": 0,
    "z": 212
  },
  "obstacles": [
    {
      "id": "camp-building-0",
      "x": -20,
      "z": 190,
      "w": 8,
      "d": 8,
      "h": 4.1,
      "kind": "hut",
      "rotation": 0
    },
    {
      "id": "camp-building-1",
      "x": 19,
      "z": 189,
      "w": 10,
      "d": 10,
      "h": 4.55,
      "kind": "hut",
      "rotation": 0
    },
    {
      "id": "camp-building-2",
      "x": -20,
      "z": 222,
      "w": 8,
      "d": 12,
      "h": 5.0,
      "kind": "hut",
      "rotation": 0
    },
    {
      "id": "camp-building-3",
      "x": 19,
      "z": 223,
      "w": 10,
      "d": 8,
      "h": 4.1,
      "kind": "hut",
      "rotation": 0
    },
    {
      "id": "camp-cover-0",
      "x": -12,
      "z": 198,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "camp-cover-1",
      "x": 12,
      "z": 214,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "camp-cover-2",
      "x": -30,
      "z": 233,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "camp-cover-5",
      "x": 35,
      "z": 231,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "armory-building-0",
      "x": -155,
      "z": -106,
      "w": 13,
      "d": 8,
      "h": 4.1,
      "kind": "armory",
      "rotation": 0
    },
    {
      "id": "armory-building-1",
      "x": -116,
      "z": -107,
      "w": 15,
      "d": 10,
      "h": 4.55,
      "kind": "armory",
      "rotation": 0
    },
    {
      "id": "armory-building-2",
      "x": -155,
      "z": -74,
      "w": 13,
      "d": 12,
      "h": 5.0,
      "kind": "armory",
      "rotation": 0
    },
    {
      "id": "armory-building-3",
      "x": -116,
      "z": -73,
      "w": 15,
      "d": 8,
      "h": 4.1,
      "kind": "armory",
      "rotation": 0
    },
    {
      "id": "armory-building-4",
      "x": -173,
      "z": -95,
      "w": 7,
      "d": 3,
      "h": 2.7,
      "kind": "container",
      "rotation": 0
    },
    {
      "id": "armory-building-5",
      "x": -98,
      "z": -84,
      "w": 7,
      "d": 3,
      "h": 2.7,
      "kind": "container",
      "rotation": 0
    },
    {
      "id": "armory-building-6",
      "x": -142,
      "z": -122,
      "w": 13,
      "d": 8,
      "h": 4.1,
      "kind": "generator",
      "rotation": 0
    },
    {
      "id": "armory-building-7",
      "x": -127,
      "z": -56,
      "w": 15,
      "d": 10,
      "h": 4.55,
      "kind": "office",
      "rotation": 0
    },
    {
      "id": "armory-cover-0",
      "x": -147,
      "z": -98,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "armory-cover-2",
      "x": -165,
      "z": -63,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "armory-cover-3",
      "x": -105,
      "z": -117,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "armory-cover-4",
      "x": -170,
      "z": -114,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "armory-cover-5",
      "x": -100,
      "z": -65,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "support-building-0",
      "x": 130,
      "z": -16,
      "w": 13,
      "d": 8,
      "h": 4.1,
      "kind": "support-center",
      "rotation": 0
    },
    {
      "id": "support-building-1",
      "x": 169,
      "z": -17,
      "w": 15,
      "d": 10,
      "h": 4.55,
      "kind": "support-center",
      "rotation": 0
    },
    {
      "id": "support-building-2",
      "x": 130,
      "z": 16,
      "w": 13,
      "d": 12,
      "h": 5.0,
      "kind": "support-center",
      "rotation": 0
    },
    {
      "id": "support-building-3",
      "x": 169,
      "z": 17,
      "w": 15,
      "d": 8,
      "h": 4.1,
      "kind": "support-center",
      "rotation": 0
    },
    {
      "id": "support-building-4",
      "x": 129,
      "z": -8,
      "w": 7,
      "d": 3,
      "h": 2.7,
      "kind": "container",
      "rotation": 0
    },
    {
      "id": "support-building-5",
      "x": 187,
      "z": 6,
      "w": 7,
      "d": 3,
      "h": 2.7,
      "kind": "container",
      "rotation": 0
    },
    {
      "id": "support-building-6",
      "x": 143,
      "z": -32,
      "w": 13,
      "d": 8,
      "h": 4.1,
      "kind": "generator",
      "rotation": 0
    },
    {
      "id": "support-building-7",
      "x": 158,
      "z": 34,
      "w": 15,
      "d": 10,
      "h": 4.55,
      "kind": "office",
      "rotation": 0
    },
    {
      "id": "support-cover-0",
      "x": 138,
      "z": -8,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "support-cover-1",
      "x": 162,
      "z": 8,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "support-cover-2",
      "x": 129,
      "z": 27,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "support-cover-4",
      "x": 122,
      "z": -24,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "support-cover-5",
      "x": 185,
      "z": 25,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "barracks-building-0",
      "x": -20,
      "z": 109,
      "w": 13,
      "d": 8,
      "h": 4.1,
      "kind": "barracks",
      "rotation": 0
    },
    {
      "id": "barracks-building-1",
      "x": 19,
      "z": 108,
      "w": 15,
      "d": 10,
      "h": 4.55,
      "kind": "barracks",
      "rotation": 0
    },
    {
      "id": "barracks-building-2",
      "x": -20,
      "z": 141,
      "w": 13,
      "d": 12,
      "h": 5.0,
      "kind": "barracks",
      "rotation": 0
    },
    {
      "id": "barracks-building-3",
      "x": 19,
      "z": 142,
      "w": 15,
      "d": 8,
      "h": 4.1,
      "kind": "barracks",
      "rotation": 0
    },
    {
      "id": "barracks-building-4",
      "x": -38,
      "z": 120,
      "w": 7,
      "d": 3,
      "h": 2.7,
      "kind": "container",
      "rotation": 0
    },
    {
      "id": "barracks-building-5",
      "x": 37,
      "z": 131,
      "w": 7,
      "d": 3,
      "h": 2.7,
      "kind": "container",
      "rotation": 0
    },
    {
      "id": "barracks-building-6",
      "x": -7,
      "z": 93,
      "w": 13,
      "d": 8,
      "h": 4.1,
      "kind": "generator",
      "rotation": 0
    },
    {
      "id": "barracks-building-7",
      "x": 8,
      "z": 159,
      "w": 15,
      "d": 10,
      "h": 4.55,
      "kind": "office",
      "rotation": 0
    },
    {
      "id": "barracks-cover-0",
      "x": -12,
      "z": 117,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "barracks-cover-1",
      "x": 12,
      "z": 133,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "barracks-cover-2",
      "x": -30,
      "z": 152,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "barracks-cover-3",
      "x": 30,
      "z": 98,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "barracks-cover-4",
      "x": -35,
      "z": 101,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "barracks-cover-5",
      "x": 35,
      "z": 150,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "hydro-building-0",
      "x": 115,
      "z": -161,
      "w": 13,
      "d": 8,
      "h": 4.1,
      "kind": "hydro",
      "rotation": 0
    },
    {
      "id": "hydro-building-1",
      "x": 154,
      "z": -162,
      "w": 15,
      "d": 10,
      "h": 4.55,
      "kind": "hydro",
      "rotation": 0
    },
    {
      "id": "hydro-building-2",
      "x": 120,
      "z": -129,
      "w": 13,
      "d": 12,
      "h": 5.0,
      "kind": "hydro",
      "rotation": 0
    },
    {
      "id": "hydro-building-3",
      "x": 154,
      "z": -128,
      "w": 15,
      "d": 8,
      "h": 4.1,
      "kind": "hydro",
      "rotation": 0
    },
    {
      "id": "hydro-building-4",
      "x": 97,
      "z": -150,
      "w": 7,
      "d": 3,
      "h": 2.7,
      "kind": "container",
      "rotation": 0
    },
    {
      "id": "hydro-building-5",
      "x": 172,
      "z": -139,
      "w": 7,
      "d": 3,
      "h": 2.7,
      "kind": "container",
      "rotation": 0
    },
    {
      "id": "hydro-building-6",
      "x": 128,
      "z": -177,
      "w": 13,
      "d": 8,
      "h": 4.1,
      "kind": "generator",
      "rotation": 0
    },
    {
      "id": "hydro-building-7",
      "x": 143,
      "z": -111,
      "w": 15,
      "d": 10,
      "h": 4.55,
      "kind": "office",
      "rotation": 0
    },
    {
      "id": "hydro-cover-0",
      "x": 123,
      "z": -153,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "hydro-cover-1",
      "x": 147,
      "z": -137,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "hydro-cover-2",
      "x": 118,
      "z": -118,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "hydro-cover-3",
      "x": 165,
      "z": -172,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "hydro-cover-4",
      "x": 100,
      "z": -169,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "hydro-cover-5",
      "x": 170,
      "z": -120,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "market-building-0",
      "x": -178,
      "z": -195,
      "w": 8,
      "d": 8,
      "h": 4.1,
      "kind": "market",
      "rotation": 0
    },
    {
      "id": "market-building-1",
      "x": -139,
      "z": -196,
      "w": 10,
      "d": 10,
      "h": 4.55,
      "kind": "market",
      "rotation": 0
    },
    {
      "id": "market-building-2",
      "x": -178,
      "z": -163,
      "w": 8,
      "d": 12,
      "h": 5.0,
      "kind": "market",
      "rotation": 0
    },
    {
      "id": "market-building-3",
      "x": -139,
      "z": -162,
      "w": 10,
      "d": 8,
      "h": 4.1,
      "kind": "market",
      "rotation": 0
    },
    {
      "id": "market-building-4",
      "x": -196,
      "z": -184,
      "w": 7,
      "d": 3,
      "h": 2.7,
      "kind": "container",
      "rotation": 0
    },
    {
      "id": "market-building-5",
      "x": -121,
      "z": -173,
      "w": 7,
      "d": 3,
      "h": 2.7,
      "kind": "container",
      "rotation": 0
    },
    {
      "id": "market-cover-0",
      "x": -170,
      "z": -187,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "market-cover-1",
      "x": -146,
      "z": -171,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "market-cover-2",
      "x": -188,
      "z": -152,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "market-cover-3",
      "x": -128,
      "z": -206,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "market-cover-4",
      "x": -193,
      "z": -203,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "market-cover-5",
      "x": -123,
      "z": -154,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "fishing-building-0",
      "x": -160,
      "z": 129,
      "w": 8,
      "d": 8,
      "h": 4.1,
      "kind": "hut",
      "rotation": 0
    },
    {
      "id": "fishing-building-1",
      "x": -121,
      "z": 128,
      "w": 10,
      "d": 10,
      "h": 4.55,
      "kind": "hut",
      "rotation": 0
    },
    {
      "id": "fishing-building-2",
      "x": -160,
      "z": 161,
      "w": 8,
      "d": 12,
      "h": 5.0,
      "kind": "hut",
      "rotation": 0
    },
    {
      "id": "fishing-building-3",
      "x": -121,
      "z": 162,
      "w": 10,
      "d": 8,
      "h": 4.1,
      "kind": "hut",
      "rotation": 0
    },
    {
      "id": "fishing-building-4",
      "x": -178,
      "z": 140,
      "w": 7,
      "d": 3,
      "h": 2.7,
      "kind": "container",
      "rotation": 0
    },
    {
      "id": "fishing-building-5",
      "x": -103,
      "z": 151,
      "w": 7,
      "d": 3,
      "h": 2.7,
      "kind": "container",
      "rotation": 0
    },
    {
      "id": "fishing-building-6",
      "x": -147,
      "z": 113,
      "w": 8,
      "d": 8,
      "h": 4.1,
      "kind": "generator",
      "rotation": 0
    },
    {
      "id": "fishing-building-7",
      "x": -132,
      "z": 179,
      "w": 10,
      "d": 10,
      "h": 4.55,
      "kind": "office",
      "rotation": 0
    },
    {
      "id": "fishing-cover-0",
      "x": -152,
      "z": 137,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "fishing-cover-1",
      "x": -128,
      "z": 153,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "fishing-cover-2",
      "x": -170,
      "z": 172,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "fishing-cover-3",
      "x": -110,
      "z": 118,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "fishing-cover-4",
      "x": -175,
      "z": 121,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "fishing-cover-5",
      "x": -105,
      "z": 170,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "wheat-building-0",
      "x": 125,
      "z": 134,
      "w": 8,
      "d": 8,
      "h": 4.1,
      "kind": "workshop",
      "rotation": 0
    },
    {
      "id": "wheat-building-1",
      "x": 164,
      "z": 133,
      "w": 10,
      "d": 10,
      "h": 4.55,
      "kind": "workshop",
      "rotation": 0
    },
    {
      "id": "wheat-building-2",
      "x": 125,
      "z": 166,
      "w": 8,
      "d": 12,
      "h": 5.0,
      "kind": "workshop",
      "rotation": 0
    },
    {
      "id": "wheat-building-3",
      "x": 164,
      "z": 167,
      "w": 10,
      "d": 8,
      "h": 4.1,
      "kind": "workshop",
      "rotation": 0
    },
    {
      "id": "wheat-building-4",
      "x": 107,
      "z": 145,
      "w": 7,
      "d": 3,
      "h": 2.7,
      "kind": "container",
      "rotation": 0
    },
    {
      "id": "wheat-building-5",
      "x": 182,
      "z": 156,
      "w": 7,
      "d": 3,
      "h": 2.7,
      "kind": "container",
      "rotation": 0
    },
    {
      "id": "wheat-building-6",
      "x": 138,
      "z": 118,
      "w": 8,
      "d": 8,
      "h": 4.1,
      "kind": "generator",
      "rotation": 0
    },
    {
      "id": "wheat-building-7",
      "x": 153,
      "z": 184,
      "w": 10,
      "d": 10,
      "h": 4.55,
      "kind": "office",
      "rotation": 0
    },
    {
      "id": "wheat-cover-1",
      "x": 157,
      "z": 158,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "wheat-cover-3",
      "x": 175,
      "z": 123,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "wheat-cover-4",
      "x": 110,
      "z": 126,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "coal-building-0",
      "x": -210,
      "z": -56,
      "w": 8,
      "d": 8,
      "h": 4.1,
      "kind": "workshop",
      "rotation": 0
    },
    {
      "id": "coal-building-1",
      "x": -171,
      "z": -57,
      "w": 10,
      "d": 10,
      "h": 4.55,
      "kind": "workshop",
      "rotation": 0
    },
    {
      "id": "coal-building-2",
      "x": -210,
      "z": -24,
      "w": 8,
      "d": 12,
      "h": 5.0,
      "kind": "workshop",
      "rotation": 0
    },
    {
      "id": "coal-building-3",
      "x": -171,
      "z": -23,
      "w": 10,
      "d": 8,
      "h": 4.1,
      "kind": "workshop",
      "rotation": 0
    },
    {
      "id": "coal-building-4",
      "x": -228,
      "z": -45,
      "w": 7,
      "d": 3,
      "h": 2.7,
      "kind": "container",
      "rotation": 0
    },
    {
      "id": "coal-building-5",
      "x": -153,
      "z": -34,
      "w": 7,
      "d": 3,
      "h": 2.7,
      "kind": "container",
      "rotation": 0
    },
    {
      "id": "coal-cover-0",
      "x": -202,
      "z": -48,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "coal-cover-2",
      "x": -220,
      "z": -13,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "coal-cover-4",
      "x": -225,
      "z": -64,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "coal-cover-5",
      "x": -155,
      "z": -15,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "moon-building-0",
      "x": -85,
      "z": -193,
      "w": 8,
      "d": 8,
      "h": 4.1,
      "kind": "hut",
      "rotation": 0
    },
    {
      "id": "moon-building-1",
      "x": -46,
      "z": -194,
      "w": 10,
      "d": 10,
      "h": 4.55,
      "kind": "hut",
      "rotation": 0
    },
    {
      "id": "moon-building-2",
      "x": -85,
      "z": -161,
      "w": 8,
      "d": 12,
      "h": 5.0,
      "kind": "hut",
      "rotation": 0
    },
    {
      "id": "moon-building-3",
      "x": -46,
      "z": -160,
      "w": 10,
      "d": 8,
      "h": 4.1,
      "kind": "hut",
      "rotation": 0
    },
    {
      "id": "moon-building-4",
      "x": -103,
      "z": -182,
      "w": 7,
      "d": 3,
      "h": 2.7,
      "kind": "container",
      "rotation": 0
    },
    {
      "id": "moon-building-5",
      "x": -28,
      "z": -171,
      "w": 7,
      "d": 3,
      "h": 2.7,
      "kind": "container",
      "rotation": 0
    },
    {
      "id": "moon-cover-0",
      "x": -77,
      "z": -185,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "moon-cover-1",
      "x": -53,
      "z": -169,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "moon-cover-2",
      "x": -95,
      "z": -150,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "moon-cover-3",
      "x": -35,
      "z": -204,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "moon-cover-4",
      "x": -100,
      "z": -201,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "moon-cover-5",
      "x": -30,
      "z": -152,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "quiet-building-0",
      "x": 160,
      "z": 74,
      "w": 8,
      "d": 8,
      "h": 4.1,
      "kind": "hut",
      "rotation": 0
    },
    {
      "id": "quiet-building-1",
      "x": 199,
      "z": 73,
      "w": 10,
      "d": 10,
      "h": 4.55,
      "kind": "hut",
      "rotation": 0
    },
    {
      "id": "quiet-building-2",
      "x": 160,
      "z": 106,
      "w": 8,
      "d": 12,
      "h": 5.0,
      "kind": "hut",
      "rotation": 0
    },
    {
      "id": "quiet-building-3",
      "x": 199,
      "z": 107,
      "w": 10,
      "d": 8,
      "h": 4.1,
      "kind": "hut",
      "rotation": 0
    },
    {
      "id": "quiet-building-4",
      "x": 142,
      "z": 85,
      "w": 7,
      "d": 3,
      "h": 2.7,
      "kind": "container",
      "rotation": 0
    },
    {
      "id": "quiet-building-5",
      "x": 217,
      "z": 96,
      "w": 7,
      "d": 3,
      "h": 2.7,
      "kind": "container",
      "rotation": 0
    },
    {
      "id": "quiet-cover-1",
      "x": 192,
      "z": 98,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "quiet-cover-2",
      "x": 150,
      "z": 117,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "quiet-cover-3",
      "x": 210,
      "z": 63,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "quiet-cover-4",
      "x": 145,
      "z": 66,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "quiet-cover-5",
      "x": 215,
      "z": 115,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "ruins-building-0",
      "x": 70,
      "z": 54,
      "w": 8,
      "d": 8,
      "h": 4.1,
      "kind": "bunker",
      "rotation": 0
    },
    {
      "id": "ruins-building-1",
      "x": 137,
      "z": 53,
      "w": 10,
      "d": 10,
      "h": 4.55,
      "kind": "bunker",
      "rotation": 0
    },
    {
      "id": "ruins-building-2",
      "x": 70,
      "z": 86,
      "w": 8,
      "d": 12,
      "h": 5.0,
      "kind": "bunker",
      "rotation": 0
    },
    {
      "id": "ruins-building-3",
      "x": 109,
      "z": 87,
      "w": 10,
      "d": 8,
      "h": 4.1,
      "kind": "bunker",
      "rotation": 0
    },
    {
      "id": "ruins-building-4",
      "x": 52,
      "z": 65,
      "w": 7,
      "d": 3,
      "h": 2.7,
      "kind": "container",
      "rotation": 0
    },
    {
      "id": "ruins-building-5",
      "x": 127,
      "z": 76,
      "w": 7,
      "d": 3,
      "h": 2.7,
      "kind": "container",
      "rotation": 0
    },
    {
      "id": "ruins-cover-0",
      "x": 78,
      "z": 62,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "ruins-cover-1",
      "x": 102,
      "z": 78,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "ruins-cover-2",
      "x": 60,
      "z": 97,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "ruins-cover-3",
      "x": 129,
      "z": 43,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "ruins-cover-4",
      "x": 55,
      "z": 46,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "ruins-cover-5",
      "x": 125,
      "z": 95,
      "w": 4.5,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "missile-silo",
      "x": -24,
      "z": -25,
      "w": 12,
      "d": 13,
      "h": 3.8,
      "kind": "silo",
      "rotation": 0
    },
    {
      "id": "silo-launch-utility",
      "x": -37,
      "z": -37,
      "w": 6,
      "d": 4,
      "h": 2.8,
      "kind": "container",
      "rotation": 0
    },
    {
      "id": "silo-factory",
      "x": 25,
      "z": -25,
      "w": 16,
      "d": 11,
      "h": 5.1,
      "kind": "workshop",
      "rotation": 0
    },
    {
      "id": "silo-factory-utility",
      "x": 38,
      "z": -37,
      "w": 6,
      "d": 4,
      "h": 2.8,
      "kind": "generator",
      "rotation": 0
    },
    {
      "id": "silo-warehouse",
      "x": -24,
      "z": 25,
      "w": 16,
      "d": 11,
      "h": 5.1,
      "kind": "armory",
      "rotation": 0
    },
    {
      "id": "silo-warehouse-utility",
      "x": -37,
      "z": 37,
      "w": 6,
      "d": 4,
      "h": 2.8,
      "kind": "container",
      "rotation": 0
    },
    {
      "id": "silo-dispatch",
      "x": 25,
      "z": 25,
      "w": 16,
      "d": 11,
      "h": 5.1,
      "kind": "office",
      "rotation": 0
    },
    {
      "id": "silo-dispatch-utility",
      "x": 38,
      "z": 37,
      "w": 6,
      "d": 4,
      "h": 2.8,
      "kind": "generator",
      "rotation": 0
    },
    {
      "id": "silo-wall-x--1--39",
      "x": -51,
      "z": -39,
      "w": 1.4,
      "d": 15,
      "h": 2.3,
      "kind": "blast-wall",
      "rotation": 0
    },
    {
      "id": "silo-wall-z--1--39",
      "x": -39,
      "z": -51,
      "w": 15,
      "d": 1.4,
      "h": 2.3,
      "kind": "blast-wall",
      "rotation": 0
    },
    {
      "id": "silo-wall-x--1--19",
      "x": -51,
      "z": -19,
      "w": 1.4,
      "d": 15,
      "h": 2.3,
      "kind": "blast-wall",
      "rotation": 0
    },
    {
      "id": "silo-wall-z--1--19",
      "x": -19,
      "z": -51,
      "w": 15,
      "d": 1.4,
      "h": 2.3,
      "kind": "blast-wall",
      "rotation": 0
    },
    {
      "id": "silo-wall-x--1-19",
      "x": -51,
      "z": 19,
      "w": 1.4,
      "d": 15,
      "h": 2.3,
      "kind": "blast-wall",
      "rotation": 0
    },
    {
      "id": "silo-wall-z--1-19",
      "x": 19,
      "z": -51,
      "w": 15,
      "d": 1.4,
      "h": 2.3,
      "kind": "blast-wall",
      "rotation": 0
    },
    {
      "id": "silo-wall-x--1-39",
      "x": -51,
      "z": 39,
      "w": 1.4,
      "d": 15,
      "h": 2.3,
      "kind": "blast-wall",
      "rotation": 0
    },
    {
      "id": "silo-wall-z--1-39",
      "x": 39,
      "z": -51,
      "w": 15,
      "d": 1.4,
      "h": 2.3,
      "kind": "blast-wall",
      "rotation": 0
    },
    {
      "id": "silo-wall-x-1--39",
      "x": 51,
      "z": -39,
      "w": 1.4,
      "d": 15,
      "h": 2.3,
      "kind": "blast-wall",
      "rotation": 0
    },
    {
      "id": "silo-wall-z-1--39",
      "x": -39,
      "z": 51,
      "w": 15,
      "d": 1.4,
      "h": 2.3,
      "kind": "blast-wall",
      "rotation": 0
    },
    {
      "id": "silo-wall-x-1--19",
      "x": 51,
      "z": -19,
      "w": 1.4,
      "d": 15,
      "h": 2.3,
      "kind": "blast-wall",
      "rotation": 0
    },
    {
      "id": "silo-wall-z-1--19",
      "x": -19,
      "z": 51,
      "w": 15,
      "d": 1.4,
      "h": 2.3,
      "kind": "blast-wall",
      "rotation": 0
    },
    {
      "id": "silo-wall-x-1-19",
      "x": 51,
      "z": 19,
      "w": 1.4,
      "d": 15,
      "h": 2.3,
      "kind": "blast-wall",
      "rotation": 0
    },
    {
      "id": "silo-wall-z-1-19",
      "x": 19,
      "z": 51,
      "w": 15,
      "d": 1.4,
      "h": 2.3,
      "kind": "blast-wall",
      "rotation": 0
    },
    {
      "id": "silo-wall-x-1-39",
      "x": 51,
      "z": 39,
      "w": 1.4,
      "d": 15,
      "h": 2.3,
      "kind": "blast-wall",
      "rotation": 0
    },
    {
      "id": "silo-wall-z-1-39",
      "x": 39,
      "z": 51,
      "w": 15,
      "d": 1.4,
      "h": 2.3,
      "kind": "blast-wall",
      "rotation": 0
    },
    {
      "id": "silo-inner-cover-0",
      "x": -13,
      "z": -7,
      "w": 4,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "silo-inner-cover-1",
      "x": 14,
      "z": 8,
      "w": 4,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "silo-inner-cover-2",
      "x": -8,
      "z": 15,
      "w": 4,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "silo-inner-cover-3",
      "x": 8,
      "z": -15,
      "w": 4,
      "d": 1.2,
      "h": 1.1,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "trench-lip-0--1",
      "x": -3.25,
      "z": 58.0,
      "w": 0.65,
      "d": 8,
      "h": 0.74,
      "kind": "trench-lip",
      "rotation": 0
    },
    {
      "id": "trench-lip-0-1",
      "x": 3.25,
      "z": 58.0,
      "w": 0.65,
      "d": 8,
      "h": 0.74,
      "kind": "trench-lip",
      "rotation": 0
    },
    {
      "id": "trench-lip-1--1",
      "x": 58.0,
      "z": 3.25,
      "w": 8,
      "d": 0.65,
      "h": 0.74,
      "kind": "trench-lip",
      "rotation": 0
    },
    {
      "id": "trench-lip-1-1",
      "x": 58.0,
      "z": -3.25,
      "w": 8,
      "d": 0.65,
      "h": 0.74,
      "kind": "trench-lip",
      "rotation": 0
    },
    {
      "id": "trench-lip-2--1",
      "x": 3.25,
      "z": -58.0,
      "w": 0.65,
      "d": 8,
      "h": 0.74,
      "kind": "trench-lip",
      "rotation": 0
    },
    {
      "id": "trench-lip-2-1",
      "x": -3.25,
      "z": -58.0,
      "w": 0.65,
      "d": 8,
      "h": 0.74,
      "kind": "trench-lip",
      "rotation": 0
    },
    {
      "id": "trench-lip-3--1",
      "x": -58.0,
      "z": -3.25,
      "w": 8,
      "d": 0.65,
      "h": 0.74,
      "kind": "trench-lip",
      "rotation": 0
    },
    {
      "id": "trench-lip-3-1",
      "x": -58.0,
      "z": 3.25,
      "w": 8,
      "d": 0.65,
      "h": 0.74,
      "kind": "trench-lip",
      "rotation": 0
    },
    {
      "id": "route-cover-0-0",
      "x": -66,
      "z": 111,
      "w": 5,
      "d": 2,
      "h": 1.2,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "route-cover-0-1",
      "x": -57,
      "z": 118,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-0-2",
      "x": -62,
      "z": 124,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-1-0",
      "x": -108,
      "z": 38,
      "w": 5,
      "d": 2,
      "h": 1.2,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "route-cover-1-1",
      "x": -99,
      "z": 45,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-1-2",
      "x": -104,
      "z": 51,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-2-0",
      "x": -130,
      "z": 40,
      "w": 5,
      "d": 2,
      "h": 1.2,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "route-cover-2-1",
      "x": -121,
      "z": 47,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-2-2",
      "x": -126,
      "z": 53,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-3-0",
      "x": -64,
      "z": -129,
      "w": 5,
      "d": 2,
      "h": 1.2,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "route-cover-3-1",
      "x": -55,
      "z": -122,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-3-2",
      "x": -60,
      "z": -116,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-4-0",
      "x": 45,
      "z": -128,
      "w": 5,
      "d": 2,
      "h": 1.2,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "route-cover-4-1",
      "x": 54,
      "z": -121,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-4-2",
      "x": 49,
      "z": -115,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-5-1",
      "x": 119,
      "z": -74,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-5-2",
      "x": 120,
      "z": -68,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-6-0",
      "x": 122,
      "z": -49,
      "w": 5,
      "d": 2,
      "h": 1.2,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "route-cover-6-1",
      "x": 122,
      "z": -39,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-6-2",
      "x": 122,
      "z": -32,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-7-0",
      "x": 39,
      "z": 112,
      "w": 5,
      "d": 2,
      "h": 1.2,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "route-cover-7-1",
      "x": 48,
      "z": 119,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-7-2",
      "x": 43,
      "z": 125,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-8-1",
      "x": -111,
      "z": 188,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-8-2",
      "x": -116,
      "z": 194,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-9-0",
      "x": 112,
      "z": 194,
      "w": 5,
      "d": 2,
      "h": 1.2,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "route-cover-9-1",
      "x": 121,
      "z": 201,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-9-2",
      "x": 116,
      "z": 207,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-10-0",
      "x": -214,
      "z": 32,
      "w": 5,
      "d": 2,
      "h": 1.2,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "route-cover-10-1",
      "x": -205,
      "z": 39,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-10-2",
      "x": -210,
      "z": 45,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-11-0",
      "x": -195,
      "z": -127,
      "w": 5,
      "d": 2,
      "h": 1.2,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "route-cover-11-1",
      "x": -186,
      "z": -120,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-11-2",
      "x": -191,
      "z": -114,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-12-0",
      "x": 191,
      "z": -99,
      "w": 5,
      "d": 2,
      "h": 1.2,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "route-cover-12-1",
      "x": 200,
      "z": -92,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-12-2",
      "x": 195,
      "z": -86,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-13-0",
      "x": 43,
      "z": 175,
      "w": 5,
      "d": 2,
      "h": 1.2,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "route-cover-13-2",
      "x": 47,
      "z": 188,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-14-2",
      "x": -47,
      "z": 190,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-15-0",
      "x": -48,
      "z": -68,
      "w": 5,
      "d": 2,
      "h": 1.2,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "route-cover-15-1",
      "x": -39,
      "z": -61,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-16-0",
      "x": 39,
      "z": 62,
      "w": 5,
      "d": 2,
      "h": 1.2,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "route-cover-16-2",
      "x": 43,
      "z": 75,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-17-0",
      "x": 65,
      "z": 39,
      "w": 5,
      "d": 2,
      "h": 1.2,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "route-cover-17-1",
      "x": 74,
      "z": 46,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-18-0",
      "x": -75,
      "z": -45,
      "w": 5,
      "d": 2,
      "h": 1.2,
      "kind": "sandbag",
      "rotation": 0
    },
    {
      "id": "route-cover-18-1",
      "x": -66,
      "z": -38,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "route-cover-18-2",
      "x": -71,
      "z": -32,
      "w": 3,
      "d": 3,
      "h": 2.1,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "shelter-pine-1",
      "x": 60,
      "z": 136,
      "w": 2.1,
      "d": 2.1,
      "h": 5.76440185145155,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "shelter-pine-5",
      "x": 129,
      "z": 16,
      "w": 2.1,
      "d": 2.1,
      "h": 6.563180131169779,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "ridge-rock-12",
      "x": -137,
      "z": 0,
      "w": 4,
      "d": 3.5,
      "h": 2.4,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "shelter-pine-13",
      "x": -159,
      "z": 41,
      "w": 2.1,
      "d": 2.1,
      "h": 6.935670791943736,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "shelter-pine-14",
      "x": -22,
      "z": -135,
      "w": 2.1,
      "d": 2.1,
      "h": 5.222465937581406,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "ridge-rock-15",
      "x": 16,
      "z": -193,
      "w": 4,
      "d": 3.5,
      "h": 2.4,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "shelter-pine-19",
      "x": 132,
      "z": -130,
      "w": 2.1,
      "d": 2.1,
      "h": 6.766810126342911,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "ridge-rock-21",
      "x": 55,
      "z": -96,
      "w": 4,
      "d": 3.5,
      "h": 2.4,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "shelter-pine-23",
      "x": 74,
      "z": 210,
      "w": 2.1,
      "d": 2.1,
      "h": 5.814393424674584,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "ridge-rock-24",
      "x": 149,
      "z": -16,
      "w": 4,
      "d": 3.5,
      "h": 2.4,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "shelter-pine-26",
      "x": 35,
      "z": -110,
      "w": 2.1,
      "d": 2.1,
      "h": 5.198407973291353,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "ridge-rock-30",
      "x": -148,
      "z": 69,
      "w": 4,
      "d": 3.5,
      "h": 2.4,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "ridge-rock-33",
      "x": -150,
      "z": 55,
      "w": 4,
      "d": 3.5,
      "h": 2.4,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "shelter-pine-35",
      "x": 217,
      "z": -14,
      "w": 2.1,
      "d": 2.1,
      "h": 5.818808651219146,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "ridge-rock-36",
      "x": -50,
      "z": -139,
      "w": 4,
      "d": 3.5,
      "h": 2.4,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "shelter-pine-38",
      "x": -126,
      "z": 14,
      "w": 2.1,
      "d": 2.1,
      "h": 5.437924290339723,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "ridge-rock-39",
      "x": -19,
      "z": -157,
      "w": 4,
      "d": 3.5,
      "h": 2.4,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "shelter-pine-40",
      "x": 15,
      "z": -121,
      "w": 2.1,
      "d": 2.1,
      "h": 6.761444503299092,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "shelter-pine-44",
      "x": -218,
      "z": 2,
      "w": 2.1,
      "d": 2.1,
      "h": 6.124566870599247,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "ridge-rock-45",
      "x": 41,
      "z": 141,
      "w": 4,
      "d": 3.5,
      "h": 2.4,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "shelter-pine-47",
      "x": 71,
      "z": -190,
      "w": 2.1,
      "d": 2.1,
      "h": 6.750154128595019,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "ridge-rock-54",
      "x": -117,
      "z": -136,
      "w": 4,
      "d": 3.5,
      "h": 2.4,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "shelter-pine-62",
      "x": -103,
      "z": 73,
      "w": 2.1,
      "d": 2.1,
      "h": 5.143119827211505,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "shelter-pine-64",
      "x": 95,
      "z": 117,
      "w": 2.1,
      "d": 2.1,
      "h": 6.277231761304184,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "ridge-rock-72",
      "x": -111,
      "z": 21,
      "w": 4,
      "d": 3.5,
      "h": 2.4,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "ridge-rock-75",
      "x": -102,
      "z": 203,
      "w": 4,
      "d": 3.5,
      "h": 2.4,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "shelter-pine-76",
      "x": -122,
      "z": 73,
      "w": 2.1,
      "d": 2.1,
      "h": 6.986590844280592,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "shelter-pine-86",
      "x": 91,
      "z": -210,
      "w": 2.1,
      "d": 2.1,
      "h": 6.613776304055097,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "ridge-rock-87",
      "x": 9,
      "z": -222,
      "w": 4,
      "d": 3.5,
      "h": 2.4,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "ridge-rock-93",
      "x": -38,
      "z": -143,
      "w": 4,
      "d": 3.5,
      "h": 2.4,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "shelter-pine-94",
      "x": 122,
      "z": -58,
      "w": 2.1,
      "d": 2.1,
      "h": 5.616199917731182,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "ridge-rock-96",
      "x": 42,
      "z": 161,
      "w": 4,
      "d": 3.5,
      "h": 2.4,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "shelter-pine-97",
      "x": 204,
      "z": -75,
      "w": 2.1,
      "d": 2.1,
      "h": 5.342196419047093,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "shelter-pine-100",
      "x": 70,
      "z": 161,
      "w": 2.1,
      "d": 2.1,
      "h": 5.909423942043165,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "shelter-pine-104",
      "x": -202,
      "z": -79,
      "w": 2.1,
      "d": 2.1,
      "h": 6.262581168530477,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "ridge-rock-105",
      "x": -53,
      "z": -102,
      "w": 4,
      "d": 3.5,
      "h": 2.4,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "shelter-pine-109",
      "x": -39,
      "z": -213,
      "w": 2.1,
      "d": 2.1,
      "h": 5.961709069321797,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "shelter-pine-110",
      "x": -31,
      "z": -190,
      "w": 2.1,
      "d": 2.1,
      "h": 6.001885052821011,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "shelter-pine-112",
      "x": -62,
      "z": 193,
      "w": 2.1,
      "d": 2.1,
      "h": 5.73398728565198,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "shelter-pine-115",
      "x": -201,
      "z": 100,
      "w": 2.1,
      "d": 2.1,
      "h": 6.9860170781086195,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "ridge-rock-123",
      "x": -202,
      "z": 1,
      "w": 4,
      "d": 3.5,
      "h": 2.4,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "shelter-pine-125",
      "x": -191,
      "z": -14,
      "w": 2.1,
      "d": 2.1,
      "h": 6.679244195046524,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "ridge-rock-132",
      "x": -163,
      "z": 110,
      "w": 4,
      "d": 3.5,
      "h": 2.4,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "shelter-pine-134",
      "x": 151,
      "z": 53,
      "w": 2.1,
      "d": 2.1,
      "h": 5.830900700273186,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "shelter-pine-137",
      "x": -43,
      "z": 135,
      "w": 2.1,
      "d": 2.1,
      "h": 5.470386002471965,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "shelter-pine-139",
      "x": -111,
      "z": -10,
      "w": 2.1,
      "d": 2.1,
      "h": 5.564080113193091,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "shelter-pine-142",
      "x": 51,
      "z": -213,
      "w": 2.1,
      "d": 2.1,
      "h": 6.200992991558127,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "shelter-pine-149",
      "x": 208,
      "z": -43,
      "w": 2.1,
      "d": 2.1,
      "h": 5.649413307503678,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "shelter-pine-158",
      "x": -64,
      "z": 151,
      "w": 2.1,
      "d": 2.1,
      "h": 6.901318908752584,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "ridge-rock-168",
      "x": -136,
      "z": -15,
      "w": 4,
      "d": 3.5,
      "h": 2.4,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "shelter-pine-170",
      "x": 66,
      "z": -154,
      "w": 2.1,
      "d": 2.1,
      "h": 5.505973009306136,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "ridge-rock-171",
      "x": 36,
      "z": -159,
      "w": 4,
      "d": 3.5,
      "h": 2.4,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "shelter-pine-172",
      "x": -211,
      "z": 73,
      "w": 2.1,
      "d": 2.1,
      "h": 5.86349530928955,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "ridge-rock-174",
      "x": 26,
      "z": -211,
      "w": 4,
      "d": 3.5,
      "h": 2.4,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "shelter-pine-175",
      "x": -147,
      "z": -55,
      "w": 2.1,
      "d": 2.1,
      "h": 5.65625136748281,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "ridge-rock-177",
      "x": 59,
      "z": -111,
      "w": 4,
      "d": 3.5,
      "h": 2.4,
      "kind": "rock",
      "rotation": 0
    },
    {
      "id": "shelter-pine-179",
      "x": -145,
      "z": -148,
      "w": 2.1,
      "d": 2.1,
      "h": 5.264996920508949,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "shelter-pine-181",
      "x": 62,
      "z": -166,
      "w": 2.1,
      "d": 2.1,
      "h": 6.3553853102336095,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "shelter-pine-205",
      "x": 214,
      "z": -70,
      "w": 2.1,
      "d": 2.1,
      "h": 5.012616281252043,
      "kind": "tree",
      "rotation": 0
    },
    {
      "id": "shelter-pine-215",
      "x": 132,
      "z": -163,
      "w": 2.1,
      "d": 2.1,
      "h": 6.9160169910680285,
      "kind": "tree",
      "rotation": 0
    }
  ],
  "accessDoors": [],
  "lootSpawns": [
    {
      "id": "camp-cache-0",
      "x": -13,
      "z": 190,
      "pool": "medical",
      "tier": 1
    },
    {
      "id": "camp-cache-1",
      "x": 12,
      "z": 189,
      "pool": "ammo",
      "tier": 1
    },
    {
      "id": "camp-cache-2",
      "x": -13,
      "z": 222,
      "pool": "industrial",
      "tier": 1
    },
    {
      "id": "camp-cache-3",
      "x": 12,
      "z": 223,
      "pool": "village",
      "tier": 1
    },
    {
      "id": "camp-cache-4",
      "x": -30,
      "z": 201,
      "pool": "medical",
      "tier": 1
    },
    {
      "id": "camp-cache-5",
      "x": 29,
      "z": 212,
      "pool": "ammo",
      "tier": 1
    },
    {
      "id": "camp-cache-6",
      "x": 0,
      "z": 177,
      "pool": "industrial",
      "tier": 1
    },
    {
      "id": "camp-cache-7",
      "x": 0,
      "z": 235,
      "pool": "village",
      "tier": 1
    },
    {
      "id": "armory-cache-0",
      "x": -147,
      "z": -106,
      "pool": "ammo",
      "tier": 4
    },
    {
      "id": "armory-cache-1",
      "x": -125,
      "z": -107,
      "pool": "rare",
      "tier": 4
    },
    {
      "id": "armory-cache-2",
      "x": -147,
      "z": -74,
      "pool": "medical",
      "tier": 4
    },
    {
      "id": "armory-cache-3",
      "x": -125,
      "z": -73,
      "pool": "industrial",
      "tier": 4
    },
    {
      "id": "armory-cache-4",
      "x": -165,
      "z": -95,
      "pool": "ammo",
      "tier": 4
    },
    {
      "id": "armory-cache-5",
      "x": -106,
      "z": -84,
      "pool": "rare",
      "tier": 4
    },
    {
      "id": "armory-cache-6",
      "x": -134,
      "z": -119,
      "pool": "medical",
      "tier": 4
    },
    {
      "id": "armory-cache-7",
      "x": -136,
      "z": -61,
      "pool": "industrial",
      "tier": 4
    },
    {
      "id": "support-cache-0",
      "x": 138,
      "z": -16,
      "pool": "ammo",
      "tier": 3
    },
    {
      "id": "support-cache-1",
      "x": 160,
      "z": -17,
      "pool": "military",
      "tier": 3
    },
    {
      "id": "support-cache-2",
      "x": 138,
      "z": 16,
      "pool": "medical",
      "tier": 3
    },
    {
      "id": "support-cache-3",
      "x": 160,
      "z": 17,
      "pool": "industrial",
      "tier": 3
    },
    {
      "id": "support-cache-4",
      "x": 145,
      "z": -8,
      "pool": "ammo",
      "tier": 3
    },
    {
      "id": "support-cache-5",
      "x": 179,
      "z": 6,
      "pool": "military",
      "tier": 3
    },
    {
      "id": "support-cache-6",
      "x": 151,
      "z": -29,
      "pool": "medical",
      "tier": 3
    },
    {
      "id": "support-cache-7",
      "x": 149,
      "z": 29,
      "pool": "industrial",
      "tier": 3
    },
    {
      "id": "barracks-cache-0",
      "x": -12,
      "z": 109,
      "pool": "ammo",
      "tier": 3
    },
    {
      "id": "barracks-cache-1",
      "x": 10,
      "z": 108,
      "pool": "military",
      "tier": 3
    },
    {
      "id": "barracks-cache-2",
      "x": -12,
      "z": 141,
      "pool": "medical",
      "tier": 3
    },
    {
      "id": "barracks-cache-3",
      "x": 10,
      "z": 142,
      "pool": "industrial",
      "tier": 3
    },
    {
      "id": "barracks-cache-4",
      "x": -30,
      "z": 120,
      "pool": "ammo",
      "tier": 3
    },
    {
      "id": "barracks-cache-5",
      "x": 29,
      "z": 131,
      "pool": "military",
      "tier": 3
    },
    {
      "id": "barracks-cache-6",
      "x": 1,
      "z": 96,
      "pool": "medical",
      "tier": 3
    },
    {
      "id": "barracks-cache-7",
      "x": -1,
      "z": 154,
      "pool": "industrial",
      "tier": 3
    },
    {
      "id": "hydro-cache-0",
      "x": 123,
      "z": -161,
      "pool": "ammo",
      "tier": 4
    },
    {
      "id": "hydro-cache-1",
      "x": 145,
      "z": -162,
      "pool": "rare",
      "tier": 4
    },
    {
      "id": "hydro-cache-2",
      "x": 123,
      "z": -129,
      "pool": "medical",
      "tier": 4
    },
    {
      "id": "hydro-cache-3",
      "x": 145,
      "z": -128,
      "pool": "industrial",
      "tier": 4
    },
    {
      "id": "hydro-cache-4",
      "x": 105,
      "z": -150,
      "pool": "ammo",
      "tier": 4
    },
    {
      "id": "hydro-cache-5",
      "x": 164,
      "z": -139,
      "pool": "rare",
      "tier": 4
    },
    {
      "id": "hydro-cache-6",
      "x": 136,
      "z": -174,
      "pool": "medical",
      "tier": 4
    },
    {
      "id": "hydro-cache-7",
      "x": 134,
      "z": -116,
      "pool": "industrial",
      "tier": 4
    },
    {
      "id": "market-cache-0",
      "x": -171,
      "z": -195,
      "pool": "medical",
      "tier": 2
    },
    {
      "id": "market-cache-1",
      "x": -146,
      "z": -196,
      "pool": "ammo",
      "tier": 2
    },
    {
      "id": "market-cache-2",
      "x": -171,
      "z": -163,
      "pool": "industrial",
      "tier": 2
    },
    {
      "id": "market-cache-3",
      "x": -146,
      "z": -162,
      "pool": "village",
      "tier": 2
    },
    {
      "id": "market-cache-4",
      "x": -188,
      "z": -184,
      "pool": "medical",
      "tier": 2
    },
    {
      "id": "market-cache-5",
      "x": -129,
      "z": -173,
      "pool": "ammo",
      "tier": 2
    },
    {
      "id": "market-cache-6",
      "x": -158,
      "z": -208,
      "pool": "industrial",
      "tier": 2
    },
    {
      "id": "market-cache-7",
      "x": -158,
      "z": -150,
      "pool": "village",
      "tier": 2
    },
    {
      "id": "fishing-cache-0",
      "x": -153,
      "z": 129,
      "pool": "medical",
      "tier": 2
    },
    {
      "id": "fishing-cache-1",
      "x": -128,
      "z": 128,
      "pool": "ammo",
      "tier": 2
    },
    {
      "id": "fishing-cache-2",
      "x": -153,
      "z": 161,
      "pool": "industrial",
      "tier": 2
    },
    {
      "id": "fishing-cache-3",
      "x": -128,
      "z": 162,
      "pool": "village",
      "tier": 2
    },
    {
      "id": "fishing-cache-4",
      "x": -170,
      "z": 140,
      "pool": "medical",
      "tier": 2
    },
    {
      "id": "fishing-cache-5",
      "x": -111,
      "z": 151,
      "pool": "ammo",
      "tier": 2
    },
    {
      "id": "fishing-cache-6",
      "x": -140,
      "z": 116,
      "pool": "industrial",
      "tier": 2
    },
    {
      "id": "fishing-cache-7",
      "x": -140,
      "z": 174,
      "pool": "village",
      "tier": 2
    },
    {
      "id": "wheat-cache-0",
      "x": 132,
      "z": 134,
      "pool": "medical",
      "tier": 2
    },
    {
      "id": "wheat-cache-1",
      "x": 157,
      "z": 133,
      "pool": "ammo",
      "tier": 2
    },
    {
      "id": "wheat-cache-2",
      "x": 132,
      "z": 166,
      "pool": "industrial",
      "tier": 2
    },
    {
      "id": "wheat-cache-3",
      "x": 157,
      "z": 167,
      "pool": "village",
      "tier": 2
    },
    {
      "id": "wheat-cache-4",
      "x": 115,
      "z": 145,
      "pool": "medical",
      "tier": 2
    },
    {
      "id": "wheat-cache-5",
      "x": 174,
      "z": 156,
      "pool": "ammo",
      "tier": 2
    },
    {
      "id": "wheat-cache-6",
      "x": 145,
      "z": 121,
      "pool": "industrial",
      "tier": 2
    },
    {
      "id": "wheat-cache-7",
      "x": 145,
      "z": 179,
      "pool": "village",
      "tier": 2
    },
    {
      "id": "coal-cache-0",
      "x": -203,
      "z": -56,
      "pool": "medical",
      "tier": 2
    },
    {
      "id": "coal-cache-1",
      "x": -178,
      "z": -57,
      "pool": "ammo",
      "tier": 2
    },
    {
      "id": "coal-cache-2",
      "x": -203,
      "z": -24,
      "pool": "industrial",
      "tier": 2
    },
    {
      "id": "coal-cache-3",
      "x": -178,
      "z": -23,
      "pool": "village",
      "tier": 2
    },
    {
      "id": "coal-cache-4",
      "x": -220,
      "z": -45,
      "pool": "medical",
      "tier": 2
    },
    {
      "id": "coal-cache-5",
      "x": -161,
      "z": -34,
      "pool": "ammo",
      "tier": 2
    },
    {
      "id": "coal-cache-6",
      "x": -190,
      "z": -69,
      "pool": "industrial",
      "tier": 2
    },
    {
      "id": "coal-cache-7",
      "x": -190,
      "z": -11,
      "pool": "village",
      "tier": 2
    },
    {
      "id": "moon-cache-0",
      "x": -78,
      "z": -193,
      "pool": "medical",
      "tier": 2
    },
    {
      "id": "moon-cache-1",
      "x": -53,
      "z": -194,
      "pool": "ammo",
      "tier": 2
    },
    {
      "id": "moon-cache-2",
      "x": -78,
      "z": -161,
      "pool": "industrial",
      "tier": 2
    },
    {
      "id": "moon-cache-3",
      "x": -53,
      "z": -160,
      "pool": "village",
      "tier": 2
    },
    {
      "id": "moon-cache-4",
      "x": -95,
      "z": -182,
      "pool": "medical",
      "tier": 2
    },
    {
      "id": "moon-cache-5",
      "x": -36,
      "z": -171,
      "pool": "ammo",
      "tier": 2
    },
    {
      "id": "moon-cache-6",
      "x": -65,
      "z": -206,
      "pool": "industrial",
      "tier": 2
    },
    {
      "id": "moon-cache-7",
      "x": -65,
      "z": -148,
      "pool": "village",
      "tier": 2
    },
    {
      "id": "quiet-cache-0",
      "x": 167,
      "z": 74,
      "pool": "medical",
      "tier": 2
    },
    {
      "id": "quiet-cache-1",
      "x": 192,
      "z": 73,
      "pool": "ammo",
      "tier": 2
    },
    {
      "id": "quiet-cache-2",
      "x": 167,
      "z": 106,
      "pool": "industrial",
      "tier": 2
    },
    {
      "id": "quiet-cache-3",
      "x": 192,
      "z": 107,
      "pool": "village",
      "tier": 2
    },
    {
      "id": "quiet-cache-4",
      "x": 150,
      "z": 85,
      "pool": "medical",
      "tier": 2
    },
    {
      "id": "quiet-cache-5",
      "x": 209,
      "z": 96,
      "pool": "ammo",
      "tier": 2
    },
    {
      "id": "quiet-cache-6",
      "x": 180,
      "z": 61,
      "pool": "industrial",
      "tier": 2
    },
    {
      "id": "quiet-cache-7",
      "x": 180,
      "z": 119,
      "pool": "village",
      "tier": 2
    },
    {
      "id": "ruins-cache-0",
      "x": 77,
      "z": 54,
      "pool": "ammo",
      "tier": 3
    },
    {
      "id": "ruins-cache-1",
      "x": 130,
      "z": 53,
      "pool": "military",
      "tier": 3
    },
    {
      "id": "ruins-cache-2",
      "x": 77,
      "z": 86,
      "pool": "medical",
      "tier": 3
    },
    {
      "id": "ruins-cache-3",
      "x": 102,
      "z": 87,
      "pool": "industrial",
      "tier": 3
    },
    {
      "id": "ruins-cache-4",
      "x": 60,
      "z": 65,
      "pool": "ammo",
      "tier": 3
    },
    {
      "id": "ruins-cache-5",
      "x": 119,
      "z": 76,
      "pool": "military",
      "tier": 3
    },
    {
      "id": "ruins-cache-6",
      "x": 90,
      "z": 41,
      "pool": "medical",
      "tier": 3
    },
    {
      "id": "ruins-cache-7",
      "x": 90,
      "z": 99,
      "pool": "industrial",
      "tier": 3
    },
    {
      "id": "silo-cache-0",
      "x": -36,
      "z": -25,
      "pool": "rare",
      "tier": 5
    },
    {
      "id": "silo-cache-1",
      "x": -12,
      "z": -25,
      "pool": "military",
      "tier": 5
    },
    {
      "id": "silo-cache-2",
      "x": -24,
      "z": -37,
      "pool": "rare",
      "tier": 5
    },
    {
      "id": "silo-cache-3",
      "x": -24,
      "z": -13,
      "pool": "military",
      "tier": 5
    },
    {
      "id": "silo-cache-4",
      "x": -34,
      "z": -15,
      "pool": "rare",
      "tier": 5
    },
    {
      "id": "silo-cache-5",
      "x": -14,
      "z": -35,
      "pool": "military",
      "tier": 5
    },
    {
      "id": "silo-cache-6",
      "x": 13,
      "z": -25,
      "pool": "rare",
      "tier": 5
    },
    {
      "id": "silo-cache-7",
      "x": 37,
      "z": -25,
      "pool": "military",
      "tier": 5
    },
    {
      "id": "silo-cache-8",
      "x": 25,
      "z": -37,
      "pool": "rare",
      "tier": 5
    },
    {
      "id": "silo-cache-9",
      "x": 25,
      "z": -13,
      "pool": "military",
      "tier": 5
    },
    {
      "id": "silo-cache-10",
      "x": 15,
      "z": -15,
      "pool": "rare",
      "tier": 5
    },
    {
      "id": "silo-cache-11",
      "x": 35,
      "z": -33,
      "pool": "military",
      "tier": 5
    },
    {
      "id": "silo-cache-12",
      "x": -36,
      "z": 25,
      "pool": "rare",
      "tier": 5
    },
    {
      "id": "silo-cache-13",
      "x": -12,
      "z": 25,
      "pool": "military",
      "tier": 5
    },
    {
      "id": "silo-cache-14",
      "x": -24,
      "z": 13,
      "pool": "rare",
      "tier": 5
    },
    {
      "id": "silo-cache-15",
      "x": -24,
      "z": 37,
      "pool": "military",
      "tier": 5
    },
    {
      "id": "silo-cache-16",
      "x": -32,
      "z": 35,
      "pool": "rare",
      "tier": 5
    },
    {
      "id": "silo-cache-17",
      "x": -14,
      "z": 15,
      "pool": "military",
      "tier": 5
    },
    {
      "id": "silo-cache-18",
      "x": 13,
      "z": 25,
      "pool": "rare",
      "tier": 5
    },
    {
      "id": "silo-cache-19",
      "x": 37,
      "z": 25,
      "pool": "military",
      "tier": 5
    },
    {
      "id": "silo-cache-20",
      "x": 25,
      "z": 13,
      "pool": "rare",
      "tier": 5
    },
    {
      "id": "silo-cache-21",
      "x": 25,
      "z": 37,
      "pool": "military",
      "tier": 5
    },
    {
      "id": "silo-cache-22",
      "x": 15,
      "z": 35,
      "pool": "rare",
      "tier": 5
    },
    {
      "id": "silo-cache-23",
      "x": 35,
      "z": 15,
      "pool": "military",
      "tier": 5
    },
    {
      "id": "route-cache-0",
      "x": -62,
      "z": 115,
      "pool": "ammo",
      "tier": 2
    },
    {
      "id": "route-cache-2",
      "x": -126,
      "z": 44,
      "pool": "supplies",
      "tier": 2
    },
    {
      "id": "route-cache-4",
      "x": 49,
      "z": -124,
      "pool": "ammo",
      "tier": 2
    },
    {
      "id": "route-cache-6",
      "x": 124,
      "z": -43,
      "pool": "supplies",
      "tier": 2
    },
    {
      "id": "route-cache-8",
      "x": -116,
      "z": 185,
      "pool": "ammo",
      "tier": 2
    },
    {
      "id": "route-cache-10",
      "x": -210,
      "z": 36,
      "pool": "supplies",
      "tier": 2
    },
    {
      "id": "route-cache-12",
      "x": 195,
      "z": -95,
      "pool": "ammo",
      "tier": 2
    },
    {
      "id": "route-cache-14",
      "x": -47,
      "z": 181,
      "pool": "supplies",
      "tier": 2
    },
    {
      "id": "route-cache-16",
      "x": 43,
      "z": 66,
      "pool": "ammo",
      "tier": 2
    },
    {
      "id": "route-cache-18",
      "x": -71,
      "z": -41,
      "pool": "supplies",
      "tier": 2
    }
  ],
  "enemySpawns": [
    {
      "id": "armory-guard-0",
      "x": -143,
      "z": -113,
      "kind": "raider",
      "radius": 6
    },
    {
      "id": "armory-guard-1",
      "x": -125,
      "z": -68,
      "kind": "raider",
      "radius": 6
    },
    {
      "id": "armory-guard-2",
      "x": -105,
      "z": -100,
      "kind": "heavy",
      "radius": 6
    },
    {
      "id": "armory-guard-3",
      "x": -135,
      "z": -90,
      "kind": "raider",
      "radius": 6
    },
    {
      "id": "support-guard-0",
      "x": 142,
      "z": -23,
      "kind": "raider",
      "radius": 6
    },
    {
      "id": "support-guard-1",
      "x": 160,
      "z": 22,
      "kind": "raider",
      "radius": 6
    },
    {
      "id": "support-guard-2",
      "x": 180,
      "z": -10,
      "kind": "raider",
      "radius": 6
    },
    {
      "id": "support-guard-3",
      "x": 150,
      "z": 0,
      "kind": "raider",
      "radius": 6
    },
    {
      "id": "barracks-guard-0",
      "x": -8,
      "z": 102,
      "kind": "raider",
      "radius": 6
    },
    {
      "id": "barracks-guard-1",
      "x": 10,
      "z": 147,
      "kind": "raider",
      "radius": 6
    },
    {
      "id": "barracks-guard-2",
      "x": 30,
      "z": 115,
      "kind": "raider",
      "radius": 6
    },
    {
      "id": "barracks-guard-3",
      "x": 0,
      "z": 125,
      "kind": "raider",
      "radius": 6
    },
    {
      "id": "hydro-guard-0",
      "x": 127,
      "z": -168,
      "kind": "raider",
      "radius": 6
    },
    {
      "id": "hydro-guard-1",
      "x": 145,
      "z": -123,
      "kind": "raider",
      "radius": 6
    },
    {
      "id": "hydro-guard-2",
      "x": 165,
      "z": -155,
      "kind": "heavy",
      "radius": 6
    },
    {
      "id": "hydro-guard-3",
      "x": 135,
      "z": -145,
      "kind": "raider",
      "radius": 6
    },
    {
      "id": "market-guard-0",
      "x": -166,
      "z": -202,
      "kind": "scout",
      "radius": 6
    },
    {
      "id": "market-guard-1",
      "x": -148,
      "z": -157,
      "kind": "scout",
      "radius": 6
    },
    {
      "id": "market-guard-2",
      "x": -128,
      "z": -189,
      "kind": "scout",
      "radius": 6
    },
    {
      "id": "market-guard-3",
      "x": -158,
      "z": -179,
      "kind": "scout",
      "radius": 6
    },
    {
      "id": "fishing-guard-0",
      "x": -148,
      "z": 122,
      "kind": "scout",
      "radius": 6
    },
    {
      "id": "fishing-guard-1",
      "x": -130,
      "z": 167,
      "kind": "scout",
      "radius": 6
    },
    {
      "id": "fishing-guard-2",
      "x": -110,
      "z": 135,
      "kind": "scout",
      "radius": 6
    },
    {
      "id": "fishing-guard-3",
      "x": -140,
      "z": 145,
      "kind": "scout",
      "radius": 6
    },
    {
      "id": "wheat-guard-0",
      "x": 137,
      "z": 127,
      "kind": "scout",
      "radius": 6
    },
    {
      "id": "wheat-guard-1",
      "x": 155,
      "z": 172,
      "kind": "scout",
      "radius": 6
    },
    {
      "id": "wheat-guard-2",
      "x": 175,
      "z": 140,
      "kind": "scout",
      "radius": 6
    },
    {
      "id": "wheat-guard-3",
      "x": 145,
      "z": 150,
      "kind": "scout",
      "radius": 6
    },
    {
      "id": "coal-guard-0",
      "x": -198,
      "z": -63,
      "kind": "scout",
      "radius": 6
    },
    {
      "id": "coal-guard-1",
      "x": -180,
      "z": -18,
      "kind": "scout",
      "radius": 6
    },
    {
      "id": "coal-guard-2",
      "x": -160,
      "z": -50,
      "kind": "scout",
      "radius": 6
    },
    {
      "id": "coal-guard-3",
      "x": -190,
      "z": -40,
      "kind": "scout",
      "radius": 6
    },
    {
      "id": "moon-guard-0",
      "x": -73,
      "z": -200,
      "kind": "scout",
      "radius": 6
    },
    {
      "id": "moon-guard-1",
      "x": -55,
      "z": -155,
      "kind": "scout",
      "radius": 6
    },
    {
      "id": "moon-guard-2",
      "x": -35,
      "z": -187,
      "kind": "scout",
      "radius": 6
    },
    {
      "id": "moon-guard-3",
      "x": -65,
      "z": -177,
      "kind": "scout",
      "radius": 6
    },
    {
      "id": "quiet-guard-0",
      "x": 172,
      "z": 67,
      "kind": "scout",
      "radius": 6
    },
    {
      "id": "quiet-guard-1",
      "x": 190,
      "z": 112,
      "kind": "scout",
      "radius": 6
    },
    {
      "id": "quiet-guard-2",
      "x": 210,
      "z": 80,
      "kind": "scout",
      "radius": 6
    },
    {
      "id": "quiet-guard-3",
      "x": 180,
      "z": 90,
      "kind": "scout",
      "radius": 6
    },
    {
      "id": "ruins-guard-0",
      "x": 82,
      "z": 47,
      "kind": "raider",
      "radius": 6
    },
    {
      "id": "ruins-guard-1",
      "x": 100,
      "z": 92,
      "kind": "raider",
      "radius": 6
    },
    {
      "id": "ruins-guard-2",
      "x": 120,
      "z": 60,
      "kind": "raider",
      "radius": 6
    },
    {
      "id": "ruins-guard-3",
      "x": 90,
      "z": 70,
      "kind": "raider",
      "radius": 6
    },
    {
      "id": "silo-launch-guard-0",
      "x": -35,
      "z": -33,
      "kind": "commander",
      "radius": 5
    },
    {
      "id": "silo-launch-guard-1",
      "x": -13,
      "z": -17,
      "kind": "heavy",
      "radius": 5
    },
    {
      "id": "silo-factory-guard-0",
      "x": 14,
      "z": -33,
      "kind": "heavy",
      "radius": 5
    },
    {
      "id": "silo-factory-guard-1",
      "x": 36,
      "z": -17,
      "kind": "heavy",
      "radius": 5
    },
    {
      "id": "silo-warehouse-guard-0",
      "x": -35,
      "z": 17,
      "kind": "heavy",
      "radius": 5
    },
    {
      "id": "silo-warehouse-guard-1",
      "x": -13,
      "z": 33,
      "kind": "heavy",
      "radius": 5
    },
    {
      "id": "silo-dispatch-guard-0",
      "x": 14,
      "z": 17,
      "kind": "heavy",
      "radius": 5
    },
    {
      "id": "silo-dispatch-guard-1",
      "x": 36,
      "z": 33,
      "kind": "heavy",
      "radius": 5
    },
    {
      "id": "route-patrol-0",
      "x": -53,
      "z": 106,
      "kind": "scout",
      "radius": 8
    },
    {
      "id": "route-patrol-3",
      "x": -51,
      "z": -134,
      "kind": "scout",
      "radius": 8
    },
    {
      "id": "route-patrol-6",
      "x": 114,
      "z": -51,
      "kind": "scout",
      "radius": 8
    },
    {
      "id": "route-patrol-9",
      "x": 125,
      "z": 189,
      "kind": "scout",
      "radius": 8
    },
    {
      "id": "route-patrol-12",
      "x": 204,
      "z": -104,
      "kind": "scout",
      "radius": 8
    },
    {
      "id": "route-patrol-15",
      "x": -35,
      "z": -73,
      "kind": "scout",
      "radius": 8
    },
    {
      "id": "route-patrol-18",
      "x": -62,
      "z": -50,
      "kind": "scout",
      "radius": 8
    }
  ],
  "extractions": [
    {
      "id": "west-boat",
      "name": "서쪽 설원 검문소",
      "x": -220,
      "z": 20,
      "radius": 5,
      "kind": "fixed",
      "holdSeconds": 8
    },
    {
      "id": "east-gate",
      "name": "동쪽 물류 검문소",
      "x": 220,
      "z": 35,
      "radius": 5,
      "kind": "fixed",
      "holdSeconds": 8
    },
    {
      "id": "north-gate",
      "name": "북쪽 산악 검문소",
      "x": -20,
      "z": -219,
      "radius": 5,
      "kind": "fixed",
      "holdSeconds": 8
    },
    {
      "id": "south-gate",
      "name": "남쪽 철수 통로",
      "x": -70,
      "z": 219,
      "radius": 5,
      "kind": "fixed",
      "holdSeconds": 8
    },
    {
      "id": "south-helipad",
      "name": "남쪽 헬기장",
      "x": 0,
      "z": 225,
      "radius": 5,
      "kind": "helicopter",
      "holdSeconds": 0
    },
    {
      "id": "north-helipad",
      "name": "발전소 헬기장",
      "x": 185,
      "z": -208,
      "radius": 5,
      "kind": "helicopter",
      "holdSeconds": 0
    }
  ],
  "landmarks": [
    {
      "id": "camp",
      "name": "파랑모자 전진기지",
      "x": 0,
      "z": 206,
      "kind": "camp"
    },
    {
      "id": "armory",
      "name": "무기고 전초기지",
      "x": -135,
      "z": -90,
      "kind": "armory"
    },
    {
      "id": "support",
      "name": "지원 센터",
      "x": 150,
      "z": 0,
      "kind": "support"
    },
    {
      "id": "barracks",
      "name": "특수 병영",
      "x": 0,
      "z": 125,
      "kind": "barracks"
    },
    {
      "id": "hydro",
      "name": "수력 발전소",
      "x": 135,
      "z": -145,
      "kind": "hydro"
    },
    {
      "id": "market",
      "name": "암시장",
      "x": -158,
      "z": -179,
      "kind": "market"
    },
    {
      "id": "fishing",
      "name": "어촌 거주지",
      "x": -140,
      "z": 145,
      "kind": "village"
    },
    {
      "id": "wheat",
      "name": "밀밭 농장",
      "x": 145,
      "z": 150,
      "kind": "farm"
    },
    {
      "id": "coal",
      "name": "석탄 운송로",
      "x": -190,
      "z": -40,
      "kind": "industrial"
    },
    {
      "id": "moon",
      "name": "달빛 마을",
      "x": -65,
      "z": -177,
      "kind": "village"
    },
    {
      "id": "quiet",
      "name": "고요한 마을",
      "x": 180,
      "z": 90,
      "kind": "village"
    },
    {
      "id": "ruins",
      "name": "폐허 관측소",
      "x": 90,
      "z": 70,
      "kind": "ruins"
    },
    {
      "id": "silo",
      "name": "미사일 사일로",
      "x": 0,
      "z": 0,
      "kind": "silo"
    },
    {
      "id": "silo-launch",
      "name": "발사 사일로",
      "x": -24,
      "z": -25,
      "kind": "silo-sector"
    },
    {
      "id": "silo-factory",
      "name": "정비 공장",
      "x": 25,
      "z": -25,
      "kind": "silo-sector"
    },
    {
      "id": "silo-warehouse",
      "name": "군수 창고",
      "x": -24,
      "z": 25,
      "kind": "silo-sector"
    },
    {
      "id": "silo-dispatch",
      "name": "배차 통제소",
      "x": 25,
      "z": 25,
      "kind": "silo-sector"
    }
  ],
  "radiationZones": [
    {
      "id": "silo-radiation",
      "name": "미사일 사일로 방사능 구역",
      "x": 0,
      "z": 0,
      "radius": 58,
      "hpPerSecond": 2,
      "maxHpPerSecond": 0.35,
      "minMaxHp": 35
    }
  ],
  "roads": [
    {
      "x": -180,
      "z": 0,
      "w": 8,
      "d": 410
    },
    {
      "x": 0,
      "z": -180,
      "w": 368,
      "d": 8
    },
    {
      "x": 180,
      "z": 0,
      "w": 8,
      "d": 410
    },
    {
      "x": 0,
      "z": 180,
      "w": 368,
      "d": 8
    },
    {
      "x": -85,
      "z": 0,
      "w": 9,
      "d": 368
    },
    {
      "x": 0,
      "z": -85,
      "w": 368,
      "d": 9
    },
    {
      "x": 85,
      "z": 0,
      "w": 9,
      "d": 368
    },
    {
      "x": 0,
      "z": 85,
      "w": 368,
      "d": 9
    },
    {
      "x": 0,
      "z": 140,
      "w": 9,
      "d": 144
    },
    {
      "x": 0,
      "z": -140,
      "w": 9,
      "d": 144
    },
    {
      "x": 0,
      "z": 0,
      "w": 10,
      "d": 122
    },
    {
      "x": 0,
      "z": 0,
      "w": 122,
      "d": 10
    },
    {
      "x": -134,
      "z": -90,
      "w": 98,
      "d": 7
    },
    {
      "x": 136,
      "z": 0,
      "w": 104,
      "d": 8
    },
    {
      "x": 136,
      "z": -145,
      "w": 102,
      "d": 7
    },
    {
      "x": -135,
      "z": 145,
      "w": 100,
      "d": 7
    },
    {
      "x": 136,
      "z": 145,
      "w": 102,
      "d": 7
    },
    {
      "x": -65,
      "z": -175,
      "w": 7,
      "d": 40
    },
    {
      "x": 180,
      "z": 90,
      "w": 95,
      "d": 7
    },
    {
      "x": -190,
      "z": -40,
      "w": 88,
      "d": 7
    }
  ],
  "terrain": [
    {
      "id": "hydro-reservoir",
      "kind": "reservoir",
      "x": 181,
      "z": -163,
      "w": 58,
      "d": 86
    },
    {
      "id": "ice-channel-north",
      "kind": "river",
      "x": 100,
      "z": -90,
      "w": 16,
      "d": 85
    },
    {
      "id": "ice-channel-east",
      "kind": "river",
      "x": 110,
      "z": -30,
      "w": 16,
      "d": 54
    },
    {
      "id": "ice-channel-lower",
      "kind": "river",
      "x": 110,
      "z": 20,
      "w": 18,
      "d": 62
    },
    {
      "id": "fishing-ice",
      "kind": "reservoir",
      "x": -192,
      "z": 149,
      "w": 65,
      "d": 68
    },
    {
      "id": "wheat-north",
      "kind": "field",
      "x": 151,
      "z": 113,
      "w": 42,
      "d": 26
    },
    {
      "id": "wheat-south",
      "kind": "field",
      "x": 149,
      "z": 190,
      "w": 46,
      "d": 26
    },
    {
      "id": "silo-hardstand",
      "kind": "yard",
      "x": 0,
      "z": 0,
      "w": 110,
      "d": 110
    }
  ]
};

function __bcMapUpdate107(e){
 const moves={
  "support-building-1":[160,-17],"support-building-3":[160,17],
  "barracks-building-6":[-18,97],"barracks-building-7":[18,159],
  "hydro-building-6":[132,-164],"market-building-0":[-166,-195],
  "market-building-2":[-166,-163],"fishing-building-7":[-136,166],
  "wheat-building-7":[149,166],"moon-building-2":[-72,-161],
  "ruins-building-2":[70,100],"ruins-building-3":[109,100]
 };
 for(const [id,[x,z]] of Object.entries(moves)){
  const o=e.obstacles.find(o=>o.id===id);if(!o)continue;
  const ox=o.x,oz=o.z,dx=x-ox,dz=z-oz;
  for(const loot of e.lootSpawns??[])if(Math.abs(loot.x-ox)<=o.w/2+2&&Math.abs(loot.z-oz)<=o.d/2+2){loot.x+=dx;loot.z+=dz;}
  o.x=x;o.z=z;
 }
 e.roads=[
  {x:-180,z:0,w:8,d:420},{x:-85,z:0,w:9,d:368},{x:0,z:0,w:10,d:420},{x:85,z:0,w:9,d:368},{x:180,z:0,w:8,d:420},
  {x:0,z:-180,w:368,d:8},{x:0,z:-85,w:368,d:9},{x:0,z:0,w:368,d:10},{x:0,z:85,w:368,d:9},{x:0,z:180,w:368,d:8},
  {x:136,z:-145,w:102,d:7},{x:-135,z:145,w:100,d:7},{x:136,z:145,w:102,d:7},{x:-208,z:-40,w:56,d:7}
 ];

 e.obstacles=e.obstacles.filter(o=>!o.id.startsWith("silo-wall-")&&!o.id.startsWith("river-fence-")&&o.kind!=="trench-lip");
 const walls=[];
 for(const x of [-51,51])for(const z of [-28,28])walls.push({id:`silo-wall-${x}-${z}`,x,z,w:1.4,d:46,h:10,kind:"blast-wall",rotation:0});
 for(const z of [-51,51])for(const x of [-28,28])walls.push({id:`silo-wall-${x}-${z}`,x,z,w:46,d:1.4,h:10,kind:"blast-wall",rotation:0});
 const fence=(id,x,z,w,d)=>({id:`river-fence-${id}`,x,z,w,d,h:1.35,kind:"wood-fence",rotation:0});
 const fences=[
  fence("west-n",90.2,-116,1,48),fence("east-n",109.8,-116,1,48),
  fence("west-n-tail",90.2,-73,1,10),fence("west-n-joint",91.7,-68,4,1),
  fence("west-m",93.2,-37.5,1,61),fence("east-m",114.8,-42.5,1,71),
  fence("east-s-head",121.8,-13,1,12),fence("east-s-joint",118.3,-19,8,1),
  fence("west-s",98.2,40,1,66),fence("east-s",121.8,40,1,66),
  fence("north-cap",100,-140,21,1),fence("south-cap",110,73,26,1),
  fence("bridge-north-a",102.5,-92,26,1),fence("bridge-north-b",102.5,-78,26,1),
  fence("bridge-south-a",107.5,-7,30,1),fence("bridge-south-b",107.5,7,30,1)
 ];
 e.obstacles.push(...walls,...fences);
 // A boom gate sits just inside each exposed road terminus. Intersections stay open.
 const endGates=[];
 const roads=e.roads;
 for(const [index,road] of roads.entries()){
  const vertical=road.d>road.w;
  for(const direction of [-1,1]){
   const tip=vertical
    ?{x:road.x,z:road.z+direction*road.d/2}
    :{x:road.x+direction*road.w/2,z:road.z};
   const joined=roads.some((other,i)=>i!==index&&
    Math.abs(tip.x-other.x)<=other.w/2+.35&&
    Math.abs(tip.z-other.z)<=other.d/2+.35);
   if(joined)continue;
   const x=vertical?road.x:tip.x-direction*1.6;
   const z=vertical?tip.z-direction*1.6:road.z;
   const width=vertical?road.w:road.d;
   const obstacle={id:`road-end-gate-${index}-${direction<0?'minus':'plus'}`,
    x,z,w:vertical?width:.55,d:vertical?.55:width,h:1.65,
    kind:'road-gate',rotation:0};
   const blocked=e.obstacles.some(o=>o.kind!=='tree'&&o.kind!=='rock'&&
    Math.abs(o.x-x)<(o.w+obstacle.w)/2+.4&&
    Math.abs(o.z-z)<(o.d+obstacle.d)/2+.4);
   if(!blocked)endGates.push(obstacle);
  }
 }
 e.obstacles.push(...endGates);

 const radiation=e.radiationZones.find(r=>r.id==="silo-radiation");if(radiation)Object.assign(radiation,{radius:50,w:100,d:100,shape:"rect"});
 e.terrain=(e.terrain??[]).filter(t=>t.kind!=="river");
 e.terrain.push(
  {id:"ice-channel-north",kind:"river",x:100,z:-104,w:18,d:72},
  {id:"ice-channel-mid",kind:"river",x:104,z:-45,w:20,d:54},
  {id:"ice-channel-south",kind:"river",x:110,z:27,w:24,d:92}
 );
 for(const spawn of e.enemySpawns??[])for(const water of e.terrain.filter(t=>["river","reservoir"].includes(t.kind)))if(Math.abs(spawn.x-water.x)<=water.w/2+1&&Math.abs(spawn.z-water.z)<=water.d/2+1){spawn.x=Math.min(e.size/2-2,water.x+water.w/2+5);break;}
 return e;
}// Shared authored-world transformation. Runs before indoor walls/loot are derived.
function __bcNatureWorld122(e){
 const fields=e.terrain.filter(t=>t.kind==='field');
 e.terrain=e.terrain.filter(t=>t.kind!=='river');
 // Contiguous volumes reach beyond both map edges; the same volumes drive spawn rejection.
 for(let i=0;i<12;i++){
  const z=-220+i*40,x=104+4*Math.sin(z*.013)+2*Math.sin(z*.031);
  e.terrain.push({id:'river-nature-'+i,kind:'river',x,z,w:20+2*Math.sin(z*.019),d:40});
 }
 const waters=e.terrain.filter(t=>t.kind==='river'||t.kind==='reservoir');
 const overlap=(a,b,g=0)=>Math.abs(a.x-b.x)<(a.w+b.w)/2+g&&Math.abs(a.z-b.z)<(a.d+b.d)/2+g;
 const roadAt=(x,z,margin=0)=>e.roads.some(r=>r.w>r.d&&Math.abs(x-r.x)<r.w/2+margin&&Math.abs(z-r.z)<r.d/2+margin);
 e.obstacles=e.obstacles.filter(o=>!o.id.startsWith('river-fence-'));
 const movable=e.obstacles.filter(o=>!['tree','rock','wood-fence','road-gate','blast-wall','interior-wall','interior-window'].includes(o.kind));
 for(const o of movable){
  if(![...waters.filter(t=>t.kind==='river'),...fields].some(t=>overlap(o,t,2)))continue;
  const ox=o.x,oz=o.z;
  let best=null;
  for(let radius=4;radius<200&&!best;radius+=4)for(let k=0;k<40;k++){
   const a=k*Math.PI/20,c={...o,x:ox+Math.cos(a)*radius,z:oz+Math.sin(a)*radius};
   if(Math.abs(c.x)+c.w/2>e.size/2-8||Math.abs(c.z)+c.d/2>e.size/2-8)continue;
   if([...waters,...fields,...e.roads].some(t=>overlap(c,t,2)))continue;
   if(e.obstacles.some(b=>b!==o&&!['tree','rock'].includes(b.kind)&&overlap(c,b,3)))continue;
   best=c;break;
  }
  if(!best)throw Error('No natural-world placement for '+o.id);
  o.x=best.x;o.z=best.z;
  for(const l of e.lootSpawns)if(Math.abs(l.x-ox)<o.w/2+2&&Math.abs(l.z-oz)<o.d/2+2){l.x+=o.x-ox;l.z+=o.z-oz;}
 }
 const barn={id:'farm-red-barn-122',kind:'farm-barn',x:151,z:219,w:15,d:17,h:8,rotation:0,color:'#a63c32'};
 if([...e.obstacles,...fields,...waters,...e.roads].some(o=>!['tree','rock'].includes(o.kind)&&overlap(o,barn,2)))throw Error('Barn site blocked');
 e.obstacles.push(barn);
 e.obstacles=e.obstacles.filter(o=>!['tree','rock'].includes(o.kind)||(![...waters,...movable,barn].some(t=>overlap(o,t,1.5))&&!fields.some(t=>overlap(o,t,9))));
 // Continuous riverside collision fences, with openings only at crossing roads.
 // Conservative envelope covers tiny step changes between adjacent water volumes.
 const rivers=e.terrain.filter(t=>t.kind==='river');
 const previousBanks={};
 for(let z=-240;z<240;z+=2){
  const nearby=rivers.filter(t=>Math.abs(z+1-t.z)<=t.d/2+2);
  const left=Math.min(...nearby.map(t=>t.x-t.w/2))-.8,right=Math.max(...nearby.map(t=>t.x+t.w/2))+.8;
  for(const [side,x] of [['w',left],['e',right]]){
   if(!roadAt(x,z+1,1)){
    e.obstacles.push({id:'river-fence-122-'+side+'-'+z,kind:'wood-fence',x,z:z+1,w:.65,d:2.6,h:1.15,rotation:0});
    const prev=previousBanks[side];
    if(prev!==undefined&&Math.abs(prev-x)>.2&&!roadAt((x+prev)/2,z,1))e.obstacles.push({id:'river-fence-122-joint-'+side+'-'+z,kind:'wood-fence',x:(x+prev)/2,z,w:Math.abs(prev-x)+.65,d:.65,h:1.15,rotation:0});
   }
   previousBanks[side]=x;
  }
 }
 for(const r of e.roads.filter(r=>r.w>r.d)){
  const t=rivers.find(t=>Math.abs(r.z-t.z)<=t.d/2);if(!t||Math.abs(t.x-r.x)>r.w/2)continue;
  for(const sign of [-1,1])e.obstacles.push({id:'river-fence-122-bridge-'+r.z+'-'+sign,kind:'wood-fence',x:t.x,z:r.z+sign*(r.d/2+1),w:t.w+5,d:.65,h:1.4,rotation:0});
 }
 // Relocate outdoor caches and authored enemy anchors out of every water tile.
 for(const p of [...e.lootSpawns,...e.enemySpawns]){
  if(!waters.some(t=>overlap({x:p.x,z:p.z,w:1.5,d:1.5},t,1)))continue;
  const ox=p.x,oz=p.z;let found=false;
  for(let radius=3;radius<100&&!found;radius+=2)for(let k=0;k<32;k++){
   const a=k*Math.PI/16,c={x:ox+Math.cos(a)*radius,z:oz+Math.sin(a)*radius,w:1.5,d:1.5};
   if(waters.some(t=>overlap(c,t,2))||e.obstacles.some(t=>overlap(c,t,1))||e.lootSpawns.some(l=>l!==p&&Math.hypot(c.x-l.x,c.z-l.z)<3.2))continue;
   p.x=c.x;p.z=c.z;found=true;break;
  }
  if(!found)throw Error('No dry spawn for '+p.id);
 }
 return e;
}

__bcMapUpdate107(WORLD);__bcNatureWorld122(WORLD);coastalNuclearWorld(WORLD);

const ENTERABLE_KINDS=new Set<WorldBuildingKind>(['hut','armory','generator','office','support-center','barracks','hydro','market','workshop','bunker']);
const buildingSources=WORLD.obstacles.filter((o):o is WorldObstacle&{kind:WorldBuildingKind}=>ENTERABLE_KINDS.has(o.kind as WorldBuildingKind));
// Keep authored tree colliders clear of building walls and roof overhangs.
WORLD.obstacles=WORLD.obstacles.filter(o=>o.kind!=='tree'||!buildingSources.some(b=>Math.abs(o.x-b.x)<(o.w+b.w)/2+1&&Math.abs(o.z-b.z)<(o.d+b.d)/2+1));
const palette:Record<WorldBuildingKind,{wall:string;floor:string;roof:string;pool:string}>={
 hut:{wall:'#697d80',floor:'#647477',roof:'#87999b',pool:'village'},armory:{wall:'#53656b',floor:'#59696c',roof:'#73868b',pool:'military'},generator:{wall:'#60757a',floor:'#58696d',roof:'#7e9297',pool:'industrial'},office:{wall:'#63777a',floor:'#617174',roof:'#83979a',pool:'rare'},'support-center':{wall:'#61777b',floor:'#607174',roof:'#82979b',pool:'medical'},barracks:{wall:'#6a817e',floor:'#677875',roof:'#8da6a2',pool:'medical'},hydro:{wall:'#58747c',floor:'#597078',roof:'#7898a1',pool:'industrial'},market:{wall:'#596b5c',floor:'#5e6c61',roof:'#798b7a',pool:'rare'},workshop:{wall:'#647176',floor:'#5e686c',roof:'#858f92',pool:'industrial'},bunker:{wall:'#505f64',floor:'#555f62',roof:'#6f7d80',pool:'military'}
};
const sides:BuildingDoorSide[]=['north','east','south','west'];
const ENTERABLE_BUILDINGS:WorldBuilding[]=buildingSources.map((o,index)=>{const p=palette[o.kind],doorSide=sides[(index+Math.round(Math.abs(o.x+o.z)))%4];return {id:o.id,sourceKind:o.kind,name:o.id.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),x:o.x,z:o.z,w:o.w,d:o.d,shape:'rect',wallHeight:Math.max(2.4,o.h*.82),wallThickness:.55,wallColor:o.color??p.wall,floor:{color:p.floor,markings:o.kind.toUpperCase()},roof:{style:'cutaway',color:p.roof,overhang:.25,occluder:true},door:{side:doorSide,offset:0,width:Math.min(3.2,Math.max(2.6,Math.min(o.w,o.d)*.32))},occlusion:{fadeWalls:true,fadeRoof:true,keepFloor:true}};});
const enterableIds=new Set(buildingSources.map(o=>o.id));
WORLD.obstacles=WORLD.obstacles.filter(o=>!enterableIds.has(o.id));
WORLD.obstacles.push(...ENTERABLE_BUILDINGS.flatMap(buildingWallObstacles));
WORLD.buildings=ENTERABLE_BUILDINGS;styleCoastalBuildings(WORLD);
for(const b of ENTERABLE_BUILDINGS){
 const p=palette[b.sourceKind],inset=1.35,lateral=Math.min(1.15,(b.door.side==='north'||b.door.side==='south'?b.w:b.d)*.14);
 let x=b.x,z=b.z;
 if(b.door.side==='north'){x+=lateral;z+=b.d/2-inset;}else if(b.door.side==='south'){x-=lateral;z-=b.d/2-inset;}else if(b.door.side==='west'){x+=b.w/2-inset;z-=lateral;}else{x-=b.w/2-inset;z+=lateral;}
 WORLD.lootSpawns.push({id:`indoor-${b.id}`,x,z,pool:p.pool,tier:['armory','bunker','office','market'].includes(b.sourceKind)?3:2,buildingId:b.id,containerKind:b.sourceKind==='office'?'locker':b.sourceKind==='armory'?'case':'crate',searchSeconds:['armory','bunker','market'].includes(b.sourceKind)?3.2:2.5});
}

const ACCESS_ROOM_SPECS=[
 {id:'access-door-yellow',buildingId:'barracks-building-2',name:'특수 병영 보급실',color:'yellow',itemId:'password-letter-yellow',pool:'medical',tier:4},
 {id:'access-door-red',buildingId:'armory-building-2',name:'무기고 보급실',color:'red',itemId:'password-letter-red',pool:'military',tier:5},
 {id:'access-door-black',buildingId:'silo-dispatch',name:'방사능 기밀 보급실',color:'black',itemId:'password-letter-black',pool:'rare',tier:6}
] as const;
for(const spec of ACCESS_ROOM_SPECS){
 const b=ENTERABLE_BUILDINGS.find(candidate=>candidate.id===spec.buildingId);
 if(!b)throw new Error('Missing access-room building '+spec.buildingId);
 const horizontal=b.door.side==='north'||b.door.side==='south';
 const x=b.x+(b.door.side==='west'?-b.w/2:b.door.side==='east'?b.w/2:horizontal?b.door.offset:0);
 const z=b.z+(b.door.side==='north'?-b.d/2:b.door.side==='south'?b.d/2:horizontal?0:b.door.offset);
 WORLD.accessDoors.push({id:spec.id,buildingId:b.id,name:spec.name,color:spec.color,itemId:spec.itemId,x,z,w:horizontal?b.door.width:.2,d:horizontal?.2:b.door.width,h:b.wallHeight,rotation:0});
 const original=WORLD.lootSpawns.find(spawn=>spawn.buildingId===b.id);
 if(!original)throw new Error('Missing original loot in access room '+b.id);
 Object.assign(original,{accessDoorId:spec.id,pool:spec.pool,tier:spec.tier,containerKind:'crate'});
 const lateral=horizontal?'x':'z',depth=horizontal?'z':'x';
 for(const [index,lateralOffset] of [-2.2,2.2].entries()){
  const position={x:b.x,z:b.z};
  position[lateral]+=lateralOffset;
  position[depth]+=(b.door.side==='north'||b.door.side==='west'?1.2:-1.2);
  WORLD.lootSpawns.push({id:'vault-'+spec.color+'-cache-'+(index+2),x:position.x,z:position.z,pool:spec.pool,tier:spec.tier,buildingId:b.id,accessDoorId:spec.id,containerKind:'crate',searchSeconds:spec.color==='black'?4.5:3.8});
 }
}
const DOCUMENT_CABINETS=[
 ['camp-building-0',2.2,1.8],['camp-building-3',1.4,1.1],['support-building-0',-1.6,1.1],
 ['support-building-3',1.7,-1.1],['hydro-building-0',-1.5,-1.1],['hydro-building-3',1.5,1.1],
 ['fishing-building-0',-1.4,1.1],['quiet-building-3',1.4,-1.1],['ruins-building-0',-1.3,-1.1],
 ['moon-building-0',1.3,1.1],['wheat-building-0',2.2,-1.8],['wheat-building-3',1.4,-1.1]
] as const;
for(const [buildingId,dx,dz] of DOCUMENT_CABINETS){
 const b=ENTERABLE_BUILDINGS.find(candidate=>candidate.id===buildingId);
 if(!b)continue;
 WORLD.lootSpawns.push({id:'file-cabinet-'+buildingId,x:b.x+dx,z:b.z+dz,pool:'documents',tier:1+(Math.abs(Math.round(b.x+b.z))%4),buildingId,containerKind:'locker',searchSeconds:2.8});
}

// Older outdoor caches can end up beside generated indoor containers after a building move.
for(const [id,x,z] of [['market-cache-0',-174,-195],['fishing-cache-3',-132,157]] as const){
 const cache=WORLD.lootSpawns.find(spawn=>spawn.id===id);
 if(cache){cache.x=x;cache.z=z;}
}
const hydroInteriorCache=WORLD.lootSpawns.find(spawn=>spawn.id==='hydro-cache-2');
if(hydroInteriorCache)hydroInteriorCache.buildingId='hydro-building-2';
