# Welcome to unstrung

unstrung is an application designed and built specifically for screen reader users learning to play guitar.
Hopefully it will also be useful for more advanced players.
And maybe even sighted people will find some value here.
It attempts to make music notation files (e.g., .gp and MusicXML) readable using basic web technologies.
It makes full use of semantic HTML, optimized for single letter navigation from your favorite screen reader.
It might expand at some point.
It might go away at some point.
It is free and open source software, released under the MIT License.

Though Claude wrote all the code for unstrung, I decided I'd write (at least some of) the documentation.
Thus there is the perspective of a screen reader (NVDA on Windows) user throughout.
You'll hear lots of references to browse and focus modes and single letter navigation in HTML documents.
This is how a blind user can efficiently navigate a well structured document.
If you're a web developer, pay attention.
There is an elegantly simplified and usable world out there if you could only kick your React habit.

## The unstrung Application

unstrung can run within your browser, or you can install it on Windows and run it as a desktop application.

### Running from the Browser

Go to the [unstrung app on eyesunstrung (opens in new tab)](https://eyesunstrung.vip/unstrung/app/) to run unstrung within your browser.

#### Warning for Browser Version

Browsers, for very good reasons, try very hard to protect your computer from malicious websites.
You don't want to click a link and have the page install a virus.
To avoid that, your browser will ask for permission when a website wants to use resources on your computer.
For example, the website wants to read local files, or update them, or record using the microphone, or take pictures with your camera.
The browser should not allow any of these activities unless you give permission.

A problem for screen reader users is that the permission request can be presented differently in different browsers.
Also, different screen readers might handle the request differently or miss it entirely.
Even the same screen reader on the same browser can behave differently with different versions of software, and depending on whether the screen reader has third party scripts or add-ons installed.
It's a big messy world out there.

So, if you have pressed, for example, the "Open Saved Progression" button and get no response from your screen reader, there might be a permission dialog or popup sitting somewhere outside the main area of the browser.
Ideally, you should be able to press alt+shift+a to move to the popup with the request.
If that does not work, it's time to poke around your browser.

On Windows, f6 moves you between areas of the browser.
Try moving to different areas and arrowing, or ctrl+arrowing, around, and listen for a permission request.
Once you find it, look for "always allow on this site", or something similar, and check that to avoid future requests.
Always allow is not always there, and maybe you don't want to check it regardless.
It's a good idea to err on the side of caution when online.

#### Supported Browsers

For opening and saving files, unstrung uses the browser's "File System Access API".
Chrome and Edge ship with it enabled.
Brave has it but disables it by default.
If you're running Brave, I bet you can figure out how to enable it.
Firefox and Safari do not support it, according to Claude.
Nor do any mobile browsers.

Features that do not use the file system should still work in all browsers, e.g., generating and playing along with a chord progression.
Testing has been limited, though, to Chrome (done by me) and Edge (done by Claude).
And I have not tried any mobile browsers yet.
If and when I do, this section will be updated with the results.

### Running from the Desktop

unstrung began life as an Electron application.
I chose this because Electron is essentially Chrome repackaged with Node.js thrown in, installed and run as an application on your computer.
The main reason to do this is to avoid those several paragraphs above about browsers, permissions, and API support.
You know what you're getting based on the version of Electron you're using.

That does not mean there are no permission issues.
It means they are presented differently.
When you install an application from an online store (Microsoft, Apple), the developer has been vetted and the installer has been "signed" by that developer.
It's not foolproof, but it goes a long way to ensure you're not installing viruses from a vendor's store.

I have not gone through the vetting process for any online app stores.
Thus, you will need to [download the unstrung installer from the releases page of the unstrungApp repo (opens in new tab)](https://github.com/joeldodson/unstrungApp/releases/).
Unfortunately, and this is another reason I'm supporting unstrung in a browser, there is only a Windows installer.
If I get a Mac, and lots of motivation, there will be a macOS version someday.

Back to permissions.
It's generally a very bad idea to download and install programs from some rando on GitHub.
Understandably, Microsoft is going to make it very clear to you this is not a good idea.
When you run the installer you've downloaded, Windows will warn you the program is not from the Microsoft Store and is not signed.
You will have to find the "install anyway" option, and might have to jump through some other hoops.
I'm not sure what those other hoops might be; the process sometimes changes with Windows updates.
Once you have convinced Windows you want to run the installer, you'll find it works like any other installer.
After installing unstrung, you should be able to start it by pressing the windows key, typing "unstrung" and pressing enter.
Jumping through those hoops during installation means all of unstrung's features should work as advertised with no permission popups.

## Documentation

The same documentation is in both the web and desktop versions of unstrung.
The Help submenu, in the menu, lists the documents.
Each one opens as an item in the list of open items, just like a song.
The last entry in Help, About unstrung, opens a dialog with the version.

You can always go directly to [the unstrung online documentation (opens in new tab)](https://eyesunstrung.vip/unstrung/docs/).

## Videos

There is a [YouTube channel for unstrung (opens in new tab)](https://youtube.com/@unstrungApp) where videos are posted.
These are supposed to be "short" videos introducing features with some example use cases.
They are intended to be heard; there is not a whole lot going on visually.
The videos were made with screen sharing, including the ability to hear the screen reader.

You can watch the same videos from the [videos page on the unstrung website (opens in new tab)](https://eyesunstrung.vip/unstrung/videos/).
The page uses YouTube's embedded player, so you can stream each video there or click through to watch it on YouTube.
If you're familiar with YouTube's keyboard shortcuts, you have probably used shift+. (period) to speed up playback.
That does not work in the embedded player.
To change playback speed, there is a Playback speed drop-down above each video.
The speed you choose applies to every video on the page, and your browser remembers it for your next visit.
