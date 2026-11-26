import React from "react";
import { Composition } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";
import { CafeShort, CAFE_FRAMES } from "./videos/cafe/Cafe";
import { PulauRunShort, PULAU_RUN_FRAMES } from "./videos/pulaurun/PulauRun";
import { JawaShort, JAWA_FRAMES } from "./videos/jawa/Jawa";
import { TamboraShort, TAMBORA_FRAMES } from "./videos/tambora/Tambora";
import { BahasaJawaShort, BAHASA_JAWA_FRAMES } from "./videos/bahasajawa/BahasaJawa";
import { PadiBebekShort, PADI_BEBEK_FRAMES } from "./videos/padibebek/PadiBebek";
import { MinaPadiShort, MINA_PADI_FRAMES } from "./videos/minapadi/MinaPadi";
import { MekariShort, MEKARI_FRAMES } from "./videos/mekari/Mekari";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="BridgeShort"
        component={BridgeShort}
        durationInFrames={BRIDGE_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="CafeShort"
        component={CafeShort}
        durationInFrames={CAFE_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="PulauRunShort"
        component={PulauRunShort}
        durationInFrames={PULAU_RUN_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="JawaShort"
        component={JawaShort}
        durationInFrames={JAWA_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="TamboraShort"
        component={TamboraShort}
        durationInFrames={TAMBORA_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="BahasaJawaShort"
        component={BahasaJawaShort}
        durationInFrames={BAHASA_JAWA_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="PadiBebekShort"
        component={PadiBebekShort}
        durationInFrames={PADI_BEBEK_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="MinaPadiShort"
        component={MinaPadiShort}
        durationInFrames={MINA_PADI_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="MekariShort"
        component={MekariShort}
        durationInFrames={MEKARI_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
