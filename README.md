# Team Pulse

A free diagnostic and learning tool for school leadership teams, shared by Bourchier Street Primary School, Shepparton.

1. The leader rates the team (21 statements: direction and unity, developing others, how we work together, and the four legs of trust).
2. The team rates it anonymously via a link or QR code. Results unlock at 3 responses.
3. The dashboard shows the team's view vs the leader's view, the biggest gaps, a "school of nice" signal, small moves to try, and a built-in action register.

Informed by Macklin & Zbar, *Driving School Improvement* (ACER, 2020) and Bryk & Schneider, *Trust in Schools* (2002). All statements and learning content are written in our own words.

## Tech
- Static front end in `public/` (no build step)
- One Netlify Function, `netlify/functions/api.mjs`, with storage in Netlify Blobs
- No names, emails or IP addresses stored with survey responses

## Develop
```
npm install
npm run dev     # http://localhost:8888, local file storage
npm test        # API smoke test
```

## Deploy
Connect this repo to Netlify (Add new site → Import from GitHub). No build settings needed: `netlify.toml` covers it. Netlify Blobs needs no setup.
