export interface BoardConfig {
  title: string;
  subtitle: string;
  leftHeader: string;
  leftItems: [string, string, string];
  leftFooter: string;
  rightHeader: string;
  rightItems: [string, string, string];
  rightFooter: string;
}

export interface StudioSceneProps {
  board?: Partial<BoardConfig>;
  exposure?: number;
  subtitleText?: string;
  subtitleAccent?: boolean;
  showWatermark?: boolean;
  watermarkText?: string;
}

export const DEFAULT_PADI_BEBEK_BOARD: BoardConfig = {
  title: "SISTEM PADI-BEBEK (AIGAMO)",
  subtitle: "Perbandingan 1 Musim Tanam",
  leftHeader: "SAWAH BIASA",
  leftItems: ["- Semprot pestisida", "- Cabut rumput manual", "- Beli pupuk kimia"],
  leftFooter: "Biaya Tinggi",
  rightHeader: "SAWAH BEBEK",
  rightItems: ["+ Keong & hama habis", "+ Pupuk alami gratis", "+ Bebek & telur bonus!"],
  rightFooter: "Panen Dobel!",
};

export const DEFAULT_MINA_PADI_BOARD: BoardConfig = {
  title: "SISTEM MINA PADI",
  subtitle: "Perbandingan 1 Musim Tanam",
  leftHeader: "SAWAH BIASA",
  leftItems: ["- Semprot hama rutin", "- Beli pupuk kimia", "- Air minim oksigen"],
  leftFooter: "Panen 1x Saja",
  rightHeader: "MINA PADI",
  rightItems: ["+ Ikan basmi wereng", "+ Pupuk & oksigen alami", "+ Bonus ikan segar!"],
  rightFooter: "Panen Beras + Ikan!",
};
