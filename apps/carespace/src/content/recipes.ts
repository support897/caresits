export type Recipe = {
  id: string;
  name: string;
  meal: "breakfast" | "lunch" | "snack" | "dinner";
  minutes: number;
  ingredients: string[];
  steps: string[];
};

export const RECIPES: Recipe[] = [
  { id: "apple-oat-porridge", name: "Apple oat porridge", meal: "breakfast", minutes: 12, ingredients: ["oats", "water", "apple", "cinnamon"], steps: ["Cook oats with water until soft.", "Stir in grated apple and a little cinnamon; cool before serving."] },
  { id: "banana-rice-bowl", name: "Banana rice bowl", meal: "breakfast", minutes: 10, ingredients: ["cooked rice", "banana", "coconut milk"], steps: ["Warm the rice with coconut milk.", "Top with sliced banana and check the serving temperature."] },
  { id: "lentil-carrot-soup", name: "Lentil and carrot soup", meal: "lunch", minutes: 35, ingredients: ["lentils", "carrot", "onion", "vegetable stock", "water", "olive oil"], steps: ["Cook onion and carrot in olive oil until soft.", "Add lentils, stock, and water; simmer until tender and cool to a suitable temperature."] },
  { id: "chicken-rice-bowl", name: "Chicken and rice bowl", meal: "lunch", minutes: 30, ingredients: ["chicken", "rice", "carrot", "peas", "olive oil"], steps: ["Cook chicken fully and prepare rice and vegetables separately.", "Check the chicken is fully cooked, then serve a child-sized portion."] },
  { id: "pumpkin-pasta", name: "Pumpkin pasta", meal: "dinner", minutes: 30, ingredients: ["pasta", "pumpkin", "olive oil", "garlic", "vegetable stock"], steps: ["Cook pasta according to its packet and retain a little cooking water.", "Cook pumpkin until soft, mash with stock, and stir through pasta."] },
  { id: "bean-tomato-stew", name: "Bean and tomato stew", meal: "dinner", minutes: 28, ingredients: ["beans", "tomato", "onion", "garlic", "vegetable stock"], steps: ["Cook onion and garlic until soft.", "Add beans, tomato, and stock; simmer until hot throughout."] },
  { id: "pear-yogurt-cup", name: "Pear and yogurt cup", meal: "snack", minutes: 5, ingredients: ["pear", "plain yogurt", "oats"], steps: ["Wash and cut the pear into an age-appropriate shape.", "Add plain yogurt and a small sprinkle of oats."] },
  { id: "hummus-veg-plate", name: "Hummus and vegetables", meal: "snack", minutes: 10, ingredients: ["hummus", "carrot", "cucumber"], steps: ["Wash vegetables and cut them to the child’s age-appropriate size.", "Serve with hummus after checking its full ingredient label."] },
  { id: "egg-spinach-muffin", name: "Egg and spinach cups", meal: "breakfast", minutes: 25, ingredients: ["egg", "spinach", "tomato", "olive oil"], steps: ["Whisk eggs and fold in chopped spinach and tomato.", "Bake in a lightly oiled tray until fully set; cool before serving."] },
  { id: "salmon-potato-cakes", name: "Salmon and potato cakes", meal: "dinner", minutes: 35, ingredients: ["salmon", "potato", "lemon", "olive oil"], steps: ["Cook salmon fully and remove every bone; mash with cooked potato.", "Shape small cakes, warm until hot throughout, and cool before serving."] },
];
