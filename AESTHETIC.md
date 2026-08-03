# Aesthetic Statement

**Aesthetic:** Romantic Academia, https://aesthetics.fandom.com/wiki/Romantic_Academia

**Page:** `poetry.html` (the rest of the site keeps its default look in `style.css`)

## How the CSS expresses it

I lovingly brought this aesthetic into birth, developing it from things I have
made, such as lanterns with hand-lettered panels taped inside and a candle 
blazing behind the paper. From there came my pallete. The background is warm
paper instead of white, body text is a warm brown instead of black, the hairline
rules are brass, and poem titles are a dusty rose (both mine and Christine's fav).
Every one of those values lives in a single theme layer of custom properties (#SST),
and each rule below points at that layer rather than repeating a color.

Two serifs carry the literary half. These are Cormorant Garamond for headings against
Georgia for reading. Each poem sits in a bordered square with sharp corners,
because paper has corners and interface cards do not, and each hangs at a 0.4
degree tilt in alternating directions, like a page taped to a wall. Hovering or
tabbing to a poem straightens it. The candle is one faint radial gradient at the
top of the page (so simple yet pretty), kept light enough to read over.
The measure is set in `ch`, so the line length tracks the font rather than the window.

## The JavaScript enhancement

An external script adds a dawn and dusk toggle to the header. One click sets a
`data-theme` attribute on the `html` element, and an eight-line dusk block
restates the theme layer, so the whole page recolors through the cascade. The
script itself never names a color. `localStorage` remembers the choice for the
next visit. Demure and elegant, in my opinion.

## One accessibility choice

I checked each color pair against WCAG rather than trusting my eye. My first
link hover reused the brass from the hairline rules and measured 3.34:1, which
meant hovering a link made it *harder* to read than leaving it alone. I added a
darker brass reserved for text, now 5.97:1; body text sits at 12.21:1. The
toggle button also ships `hidden` in the HTML and is revealed by the script, so
a reader without JavaScript never meets a control that does nothing.

## The medium is the message

I feel that the idea of the medium is the message is present all about my page.
In my poem written on a journal, in the letters inscribed on the lanters, and
even in the photo of my room, you see me dancing between mediums to create a
more rich experience. 

The aesthetic change to my poetry page touches the surface of that concept.
Now the medium changes from what it could just as easily have been on physical
paper to something unimaginable without computers: the toggling between gentle light
and sweet and subtle dark. Suddenly there are worlds you can walk between;
the medium is the deepest part of the message indeed.