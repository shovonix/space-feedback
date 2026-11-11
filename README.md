# Space Feedback

One feedback form and one private inbox for every Space app (Space Cam, Space Prompter, …).

- Apps load `https://shovonix.dev/feedback/widget.js` and call `SpaceFeedback.open({ app, version })`.
- Each message (with images or videos) is stored on the server and emailed to the owner.
- `https://shovonix.dev/feedback/` is the inbox, behind one password.

Node 18+, no dependencies. Setup: [INSTALL.md](INSTALL.md).

All rights reserved.
