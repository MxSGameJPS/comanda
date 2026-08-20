export default function manifest() {
  return {
    name: "Comanda Restaurante",
    short_name: "Comanda",
    description:
      "Comanda digital com autoatendimento, garçom, cozinha, copa, caixa e gestão.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f1ec",
    theme_color: "#171714",
    lang: "pt-BR",
    icons: [
      {
        src: "/app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
