# unstrung application

unstrung is an app built for screen reader users learning to play guitar.
It is built using HTML, CSS, and JavaScript.
It was initially built on Electron, then redesigned to work both on Electron and as a web application.

Documentation for unstrung can be found on
[eyesunstrung](https://eyesunstrung.vip/unstrung/).
This README is focused on details regarding the repo.

As an Electron app, unstrung should run on Windows, Mac, and Linux.
I only have a Windows laptop though, so there is only a Windows installer in the
[unstrungApp GitHub releases](https://github.com/joeldodson/unstrungApp/releases).
See the Clone and Run section below to run from source in your environment.
Someday, there might be an installable Mac version, and maybe Linux.
But now with unstrung as a web app, I'm not so motivated to work on either of those.

## Clone and Run

Nothing here needs a C++ compiler, Python, or Visual Studio Build Tools.
To clone the repo and run from source, do the following:

1. Prerequisites: you need [git](https://git-scm.com/) and [Node.js](https://nodejs.org/). It's been developed using Node version 24, best to use at least that.
1. Clone the [unstrungApp repo on GitHub](https://github.com/joeldodson/unstrungApp) locally. Best to get the repo clone URL directly from GitHub, it's different depending on whether you use https or ssh.
   * For https: ```git clone https://github.com/joeldodson/unstrungApp.git```
   * The repo is large due to the audio samples it stores, cloning might take a while depending on your network
1. ```cd unstrungApp```
1. ```npm install``` - this only needs to be done once, after cloning, not with each run.
1. ```npm start``` - this will start the unstrung desktop app with nothing open

### The web version

The web version is built from the same source.

1. ```npm run build:web``` - builds the web version into ```dist-web/``` and packages it as ```release/Unstrung-web-<version>.tar.gz```. The first build takes a while, because it compresses every audio sample for the browser.
1. ```npm run serve:web``` - serves it at http://localhost:8090/unstrung/app/, to open in Chrome or Edge

## Feedback

I'd love to hear what you think of unstrung.
And requests for changes and/or new features are welcomed.
Please open an issue in the
[unstrungApp issues on GitHub](https://github.com/joeldodson/unstrungApp/issues).
Please search before creating a new issue.
It's better to add a comment to an open issue if it's an issue similar to your feedback.
It helps others follow a discussion and helps me understand the level of interest and/or impact.
