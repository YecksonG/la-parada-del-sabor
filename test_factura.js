const tasa = 852.42;

const itemsTicket = [
  { name: "Pepsi 1L", bs: 1841.22, qty: 3 },
  { name: "Pepsi 1.5L", bs: 2506.11, qty: 3 },
  { name: "Harina PAN", bs: 929.14, qty: 1 },
  { name: "Mavesa 250g", bs: 1397.97, qty: 1 },
  { name: "Maggi Pollo 8und", bs: 1866.00, qty: 1 },
  { name: "Maggi Costilla 8und", bs: 1866.80, qty: 1 },
  { name: "Pampero Ketchup", bs: 1628.12, qty: 1 },
  { name: "Aji Dulce", bs: 200.32, qty: 0.125 },
  { name: "Cebolla Morada", bs: 407.24, qty: 0.195 },
  { name: "Tomate", bs: 881.36, qty: 0.305 },
  { name: "Lechuga Americana", bs: 349.53, qty: 0.295 },
  { name: "Cebolla Blanca", bs: 458.01, qty: 0.27 },
  { name: "Pimenton Redondo", bs: 285.90, qty: 0.26 },
  { name: "Cebollin", bs: 386.78, qty: 0.275 },
  { name: "Cilantro", bs: 205.86, qty: 0.115 },
  { name: "Aguacate", bs: 1150.77, qty: 0.54 },
  { name: "Ajo Blanco", bs: 712.84, qty: 0.125 },
  { name: "Queso Amarillo", bs: 4555.12, qty: 0.475 },
  { name: "Carne Desmechar", bs: 5932.42, qty: 0.775 },
  { name: "Filete Pechuga", bs: 4027.68, qty: 0.675 },
];

const totalBsTicket = itemsTicket.reduce((acc, i) => acc + i.bs, 0);
console.log("Suma items en Bs ticket:", totalBsTicket.toFixed(2));
console.log("Total Bs en ticket: 31589.99");
console.log("Total USD ticket (31589.99 / 852.42):", (31589.99 / tasa).toFixed(2), "USD (exacto:", 31589.99 / tasa, ")");

const readerItemsUSD = [
  2.16, 2.94, 1.09, 1.64, 2.19, 2.19, 1.91,
  0.24, 0.48, 1.03, 0.41, 0.54, 0.34, 0.45,
  0.24, 1.35, 0.84, 5.34, 6.96, 4.73
];

const sumReaderUSD = readerItemsUSD.reduce((acc, v) => acc + v, 0);
console.log("Suma USD de las filas del lector:", sumReaderUSD.toFixed(2));

itemsTicket.forEach((item, idx) => {
  const usdItem = item.bs / tasa;
  const readerUSD = readerItemsUSD[idx];
  const diff = readerUSD - usdItem;
  console.log(`${item.name.padEnd(20)} | Bs: ${item.bs.toFixed(2).padStart(8)} | USD calc: ${usdItem.toFixed(4)} | Lector: ${readerUSD.toFixed(2)} | Diff: ${diff > 0 ? "+" : ""}${diff.toFixed(4)}`);
});
