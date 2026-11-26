import type React from "react";
import { BridgeShort, BRIDGE_FRAMES } from "@studio/videos/bridge/Bridge";
import { CafeShort, CAFE_FRAMES } from "@studio/videos/cafe/Cafe";
import { PulauRunShort, PULAU_RUN_FRAMES } from "@studio/videos/pulaurun/PulauRun";
import { JawaShort, JAWA_FRAMES } from "@studio/videos/jawa/Jawa";
import { TamboraShort, TAMBORA_FRAMES } from "@studio/videos/tambora/Tambora";
import { BahasaJawaShort, BAHASA_JAWA_FRAMES } from "@studio/videos/bahasajawa/BahasaJawa";
import { PadiBebekShort, PADI_BEBEK_FRAMES } from "@studio/videos/padibebek/PadiBebek";
import { MinaPadiShort, MINA_PADI_FRAMES } from "@studio/videos/minapadi/MinaPadi";
import {
  DEFAULT_MINA_PADI_BOARD,
  DEFAULT_PADI_BEBEK_BOARD,
  type BoardConfig,
  type StudioSceneProps,
} from "@studio/types/studioProps";

export interface ShotBookmark {
  label: string;
  frame: number;
}

export interface EpisodeDef {
  id: string;
  name: string;
  badge: string;
  description: string;
  component: React.ComponentType<StudioSceneProps>;
  durationInFrames: number;
  fps: number;
  supportsBoardEditor: boolean;
  defaultBoard?: BoardConfig;
  defaultSubtitle: string;
  defaultScript: string;
  bookmarks: ShotBookmark[];
}

export const EPISODES: EpisodeDef[] = [
  {
    id: "MinaPadiShort",
    name: "Mina Padi Ikan Mas",
    badge: "3D Diorama v3",
    description: "24 ikan mas 3D di parit caren sawah, pintu air bambu, dan papan infografis diegetik.",
    component: MinaPadiShort,
    durationInFrames: MINA_PADI_FRAMES,
    fps: 30,
    supportsBoardEditor: true,
    defaultBoard: DEFAULT_MINA_PADI_BOARD,
    defaultSubtitle: "Sistem Mina Padi,",
    defaultScript:
      "Bayangin deh, sawah baru aja ditanam padi, eh malah dilepasi ratusan ikan mas sekaligus. Warga awalnya bingung, takut tanamannya rusak. Tapi justru ini trik jenius petani tradisional yang bikin hasil panen langsung dobel.",
    bookmarks: [
      { label: "Hook Ikan", frame: 55 },
      { label: "Konfrontasi", frame: 290 },
      { label: "Ikan Lompat", frame: 895 },
      { label: "Papan 3D", frame: 1905 },
      { label: "Panen", frame: 2115 },
    ],
  },
  {
    id: "PadiBebekShort",
    name: "Sawah Padi-Bebek (Aigamo)",
    badge: "3D Diorama v3",
    description: "Karakter 3D Pak Budi & Pak Darto, kawanan bebek 3D pembasmi hama, dan papan Aigamo.",
    component: PadiBebekShort,
    durationInFrames: PADI_BEBEK_FRAMES,
    fps: 30,
    supportsBoardEditor: true,
    defaultBoard: DEFAULT_PADI_BEBEK_BOARD,
    defaultSubtitle: "Tetangganya langsung panik:",
    defaultScript:
      "Bayangin deh, sawah baru aja ditanam, eh malah dilepasi ratusan bebek sekaligus. Warga awalnya panik, takut padinya abis dimakan semua. Kenapa bisa gitu? Soalnya di balik air lumpur itu, ada ratusan hama keong dan wereng yang siap ngancurin panen.",
    bookmarks: [
      { label: "Hook Bebek", frame: 60 },
      { label: "Konfrontasi", frame: 280 },
      { label: "Pestisida", frame: 1050 },
      { label: "Papan 3D", frame: 1950 },
      { label: "Panen Dobel", frame: 2350 },
    ],
  },
  {
    id: "TamboraShort",
    name: "Letusan Tambora 1815",
    badge: "3D Story",
    description: "Kisah letusan gunung Tambora yang mengubah iklim dunia tanpa musim panas.",
    component: TamboraShort as React.ComponentType<StudioSceneProps>,
    durationInFrames: TAMBORA_FRAMES,
    fps: 30,
    supportsBoardEditor: false,
    defaultSubtitle: "",
    defaultScript: "Tahun 1815, Gunung Tambora meletus begitu dahsyat sampai langit Eropa gelap tanpa musim panas.",
    bookmarks: [
      { label: "Opening", frame: 45 },
      { label: "Mid", frame: Math.floor(TAMBORA_FRAMES * 0.5) },
      { label: "Ending", frame: Math.floor(TAMBORA_FRAMES * 0.85) },
    ],
  },
  {
    id: "PulauRunShort",
    name: "Pulau Run vs Manhattan",
    badge: "3D Story",
    description: "Bagaimana pulau pala kecil di Maluku pernah ditukar dengan Manhattan, New York.",
    component: PulauRunShort as React.ComponentType<StudioSceneProps>,
    durationInFrames: PULAU_RUN_FRAMES,
    fps: 30,
    supportsBoardEditor: false,
    defaultSubtitle: "",
    defaultScript: "Dulu, satu pulau mungil di Maluku ini nilainya dianggap setara dengan Manhattan di New York.",
    bookmarks: [
      { label: "Opening", frame: 45 },
      { label: "Mid", frame: Math.floor(PULAU_RUN_FRAMES * 0.5) },
      { label: "Ending", frame: Math.floor(PULAU_RUN_FRAMES * 0.85) },
    ],
  },
  {
    id: "JawaShort",
    name: "Geografi Pulau Jawa",
    badge: "3D Story",
    description: "Kenapa Pulau Jawa bisa jadi salah satu pulau paling padat di dunia.",
    component: JawaShort as React.ComponentType<StudioSceneProps>,
    durationInFrames: JAWA_FRAMES,
    fps: 30,
    supportsBoardEditor: false,
    defaultSubtitle: "",
    defaultScript: "Pernah kepikiran kenapa lebih dari separuh penduduk Indonesia tinggal di satu pulau ini?",
    bookmarks: [
      { label: "Opening", frame: 45 },
      { label: "Mid", frame: Math.floor(JAWA_FRAMES * 0.5) },
    ],
  },
  {
    id: "BahasaJawaShort",
    name: "Bahasa Jawa di Suriname",
    badge: "3D Story",
    description: "Jejak komunitas dan bahasa Jawa di Amerika Selatan.",
    component: BahasaJawaShort as React.ComponentType<StudioSceneProps>,
    durationInFrames: BAHASA_JAWA_FRAMES,
    fps: 30,
    supportsBoardEditor: false,
    defaultSubtitle: "",
    defaultScript: "Ribuan kilometer dari Indonesia, ada negara di Amerika Selatan yang warganya lancar berbahasa Jawa.",
    bookmarks: [
      { label: "Opening", frame: 45 },
      { label: "Mid", frame: Math.floor(BAHASA_JAWA_FRAMES * 0.5) },
    ],
  },
  {
    id: "CafeShort",
    name: "Cafe Story",
    badge: "3D Scene",
    description: "Scene diorama kafe 3D vertikal.",
    component: CafeShort as React.ComponentType<StudioSceneProps>,
    durationInFrames: CAFE_FRAMES,
    fps: 30,
    supportsBoardEditor: false,
    defaultSubtitle: "",
    defaultScript: "Cerita santai di sudut kafe sore hari.",
    bookmarks: [{ label: "Opening", frame: 30 }],
  },
  {
    id: "BridgeShort",
    name: "The Bridge That Fell",
    badge: "3D Classic",
    description: "74 tentara yang merobohkan jembatan besi karena resonansi langkah kaki.",
    component: BridgeShort as React.ComponentType<StudioSceneProps>,
    durationInFrames: BRIDGE_FRAMES,
    fps: 30,
    supportsBoardEditor: false,
    defaultSubtitle: "",
    defaultScript: "74 tentara merobohkan jembatan besi ini cuma karena berjalan melintasinya berbarengan.",
    bookmarks: [{ label: "Opening", frame: 45 }],
  },
];
