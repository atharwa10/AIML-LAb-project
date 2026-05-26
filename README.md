# Neon Dodge

This is a simple browser game I built for my AIML Lab project. The whole idea is to survive as long as you can while a red square (the AI) tracks you down, all while dodging moving spiky obstacles and picking up power-ups to stay alive.

## Live Link
You can play it online here: 
**[INSERT YOUR GITHUB PAGES LINK HERE]**

---

## How the AI and Game Logic Actually Works

Instead of using heavy ML frameworks like TensorFlow, I simulated the AI tracking behavior using vector mathematics so it runs lightweight and smooth right in the browser.

### 1. The Tracking Algorithm
The red enemy needs to know where to go every single frame. To do this, the script:
* Calculates the straight-line distance to the player square using the distance formula: $\sqrt{(x_2-x_1)^2 + (y_2-y_1)^2}$.
* Normalizes that direction into a unit vector so the enemy moves smoothly along the shortest path toward the player.
* **The Scaling Difficulty:** To simulate a "learning" or "adapting" effect, a multiplier hooks into the game timer. Every second you stay alive, the AI's tracking speed increases by about 6%. Eventually, it gets faster than the player, forcing a game over.

### 2. Spiky Obstacles (Trigonometry)
The purple obstacles look like little spiky mines or viruses. I generated these shapes procedurally on the HTML5 Canvas loop. It alternates between an outer and inner radius while drawing lines in a circle using `Math.cos` and `Math.sin`. I also added a random rotation velocity to each one so they spin dynamically while bouncing off the walls.

### 3. Power-ups
There are three types of power-ups that spawn randomly to balance out the aggressive AI:
* ⚡ **Speed Boost:** Bumps your character's speed up by 60% so you can break away.
* 🛡️ **Shield:** Gives you a buffer ring where you can smash through obstacles safely.
* ❄️ **Slow Enemy:** Drops the AI's tracking speed by 70% for 5 seconds (gives you a breather when the AI speed gets out of hand).

---

## Tech Used
* **HTML5 Canvas:** For rendering the actual gameplay objects smoothly without bogging down the browser DOM.
* **Vanilla JavaScript:** No frameworks, just raw JS using `requestAnimationFrame` to keep the animation rendering at a locked 60fps.
* **CSS3:** Used a dark theme with standard box-shadow glows to give it that retro neon look.

---

## Controls
* Move around using **WASD** or the **Arrow Keys**.
* Pick a difficulty (Easy/Medium/Hard) on the home screen to set the AI's starting baseline speed.

---

## Author
* **Atharwa Kumar**
* AIML Lab Project (april 2026)