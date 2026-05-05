import { EmbedBuilder, type ColorResolvable } from "discord.js";

interface EmbedOptions {
  color?: ColorResolvable;
  lang?:  "pt" | "en";
}


export class EmbedStructure extends EmbedBuilder {
  constructor(options: EmbedOptions = {}) {
    super();
    this.setColor("#ffdd00");
    this.setFooter({
      text:    "Midas",
    });
    this.setTimestamp();
  }
}

export class SuccessEmbed extends EmbedStructure {
  constructor(description: string, lang?: "pt" | "en") {
    super({ color: "#57F287", lang });
    this.setDescription(`✅  ${description}`);
  }
}

export class ErrorEmbed extends EmbedStructure {
  constructor(description: string, lang?: "pt" | "en") {
    super({ color: "#ED4245", lang });
    this.setDescription(`❌  ${description}`);
  }
}

export class InfoEmbed extends EmbedStructure {
  constructor(description: string, lang?: "pt" | "en") {
    super({ color: "#5865F2", lang });
    this.setDescription(`ℹ️  ${description}`);
  }
}

export class WarnEmbed extends EmbedStructure {
  constructor(description: string, lang?: "pt" | "en") {
    super({ color: "#FEE75C", lang });
    this.setDescription(`⚠️  ${description}`);
  }
}
