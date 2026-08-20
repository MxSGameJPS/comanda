export const menuCategories = [
  { id: "pratos", label: "Pratos" },
  { id: "pizzas", label: "Pizzas" },
  { id: "bebidas", label: "Bebidas" },
  { id: "sobremesas", label: "Sobremesas" },
];

export const menuProducts = [
  { id: "p1", category: "pratos", name: "Filé executivo", description: "Filé grelhado, arroz, feijão, fritas e salada.", price: 39.9, station: "KITCHEN" },
  { id: "p2", category: "pratos", name: "Frango grelhado", description: "Frango, arroz, legumes e salada da casa.", price: 34.9, station: "KITCHEN" },
  { id: "p3", category: "pizzas", name: "Pizza Calabresa", description: "Molho da casa, muçarela, calabresa e cebola.", price: 64, station: "KITCHEN" },
  { id: "p4", category: "pizzas", name: "Pizza Margherita", description: "Molho, muçarela, tomate e manjericão.", price: 61, station: "KITCHEN" },
  { id: "p5", category: "bebidas", name: "Coca-Cola", description: "Lata 350 ml.", price: 8.5, station: "BAR" },
  { id: "p6", category: "bebidas", name: "Água mineral", description: "Com ou sem gás, 500 ml.", price: 6, station: "BAR" },
  { id: "p7", category: "sobremesas", name: "Pudim da casa", description: "Fatia individual com calda de caramelo.", price: 15.9, station: "KITCHEN" },
];

export const waiterTables = [
  { number: 1, customer: "Marina", subtotal: 86.4, status: "OPEN", staff: ["Carlos"] },
  { number: 4, customer: "João", subtotal: 173.8, status: "OPEN", staff: ["Carlos", "Pedro"] },
  { number: 8, customer: "Ana", subtotal: 59.9, status: "PAYMENT_PENDING", staff: ["Pedro"] },
];

export const productionTables = [
  { number: 1, status: "NEW", openedAt: "20:31", items: [
    { id: "i1", station: "KITCHEN", quantity: 2, name: "Filé executivo", observation: "Um sem cebola", status: "NEW" },
    { id: "i2", station: "BAR", quantity: 2, name: "Coca-Cola", observation: "", status: "NEW" },
  ] },
  { number: 4, status: "PREPARING", openedAt: "20:38", items: [
    { id: "i3", station: "KITCHEN", quantity: 1, name: "Pizza Calabresa", observation: "Sem cebola", status: "PREPARING" },
    { id: "i4", station: "KITCHEN", quantity: 1, name: "Batata grande", observation: "Bem passada", status: "NEW" },
    { id: "i5", station: "BAR", quantity: 3, name: "Cerveja", observation: "Bem gelada", status: "READY" },
  ] },
  { number: 8, status: "READY", openedAt: "20:45", items: [
    { id: "i6", station: "KITCHEN", quantity: 1, name: "Frango grelhado", observation: "", status: "READY" },
    { id: "i7", station: "BAR", quantity: 1, name: "Água mineral", observation: "Sem gás", status: "NEW" },
  ] },
];

export const cashierTables = [
  { number: 1, customer: "Marina", whatsapp: "(51) 99911-2200", arrival: "20:18", delivered: "20:42", staff: ["Carlos"], subtotal: 86.4, status: "OPEN" },
  { number: 4, customer: "João", whatsapp: "(51) 99832-7102", arrival: "20:12", delivered: "21:02", staff: ["Carlos", "Pedro"], subtotal: 173.8, status: "OPEN" },
  { number: 8, customer: "Ana", whatsapp: "(51) 99110-8834", arrival: "20:33", delivered: "20:58", staff: ["Pedro"], subtotal: 59.9, status: "PAYMENT_PENDING" },
];
