// Current explicit mappings between website products.id and Dotypos pos_products.pos_id.
// Keep this in sync with supabase/migrations/*pos_product_overrides*.sql.
export const DEFAULT_POS_PRODUCT_OVERRIDES: Readonly<Record<number, number>> = {
  1: 3906540692143412,  // Standard Burger -> 1. Standard burger
  2: 1080323362361600,  // Cheeseburger -> 2. Cheesburger
  3: 1278278405034465,  // BBQ Cheeseburger -> 3. BBQ Cheesburger
  4: 2682097055666724,  // TexMex Cheeseburger -> 4. TexMex Cheesburger
  5: 1053209233822313,  // Sweet Onion Cheeseburger -> 5. Sweet Onion Cheesburger
  6: 4462562863321757,  // Premium z Karmelizowana Gruszka -> 6. Burger Premium
  7: 4430569651933887,  // Black Burger -> 7. Black Burger
  8: 2595991581506134,  // SeroBurger -> 8. SEROburger
  9: 1350519754953500,  // Chicken Crunchy -> 11. Chicken Crunchy
  10: 2358003118478304, // BBQ Vegeburger -> 12. BBQ Vegeburger
  11: 2602580031149088, // TexMex Vegeburger -> 13. TexMex Vegeburger
  12: 1856728895427760, // Burger Miesiaca -> 14. Burger Miesiaca
  13: 2044496282353162, // Burger po Twojemu -> 15. Burger po Twojemu
  14: 3586677303906290, // Mini Zestaw Standard -> 16. Mini Cheeseburger
  15: 1974110357786740, // Mini Zestaw Chicken -> 17. Mini Chicken
  16: 118083205850393,  // Frytki (150g) -> Frytki 150g
  17: 201306765628826,  // Frytki (300g) -> Frytki 300g
  18: 2910030991582644, // Frytki z Batatow (150g) -> Frytki z batatow 150g
  19: 3751896105508721, // Frytki z Batatow (300g) -> Frytki z batatow 300g
  20: 2207112348952066, // Frytki z Serem (150g) -> Frytki z serem 150g
  21: 117945745380708,  // Classic American -> Classic American
  22: 1853503374988683, // Classic Nutella -> Classic Nutella
  23: 2130434276300277, // Tutti Fruit -> Tutti Fruit
  24: 950061299242539,  // Choco Shock -> Choco Shock
  25: 3585191239063124, // Pink Panther -> Pink Panther
  26: 1262975436559990, // Pan & Maxi King -> Maxi King
  29: 4307445928075278, // Coca-Cola 0,25 l -> Coca-cola szklo
  31: 2047713206299330, // Fanta 0,5l -> Fanta 0,25 l
  32: 2186526549184088, // Woda gazowana Kropla Beskidu 0,5l -> Woda gazowana
  33: 3534257221897752, // Woda niegazowana Kropla Beskidu 0,33l -> Woda niegazowana
  34: 975401635422285,  // Sok pomaranczowy Tymbark 1l -> Sok pomaranczowy 1L
  36: 1462111728378743, // Red Bull -> Redbull
  37: 407705747896063,  // Lemoniada (sezonowa) -> Lemoniada
  38: 4198327969183094, // DE LUXE -> 9. De Luxe
  39: 2599230040503734, // Burger Grecki -> 10. Burger Grecki
  40: 272740683212265,  // Frytki z serem 300g -> Frytki z serem 300g
  41: 822427839952649,  // Krazki cebulowe 9 szt -> Krazki cebulowe 9szt.
  44: 1635817281356994, // Coca-Cola 0,85l -> Coca-cola 0,85L
};
