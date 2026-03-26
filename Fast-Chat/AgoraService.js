// Ensure AgoraRTC is loaded in index.html like this:
// <script src="https://download.agora.io/sdk/release/AgoraRTC_N.js"></script>

const APP_ID = '864e99c6613f465492986744eb16b969';

let rtc = {
    localAudioTrack: null,
    localVideoTrack: null,
    client: null
};

let options = {
    appId: APP_ID,
    channel: '',
    token: null,
    uid: null
};

// Start a call
export const startCall = async (channelName, localPlayerContainerId, remotePlayerContainerId, onRemoteUserJoined, onRemoteUserLeft) => {
    if (!window.AgoraRTC) {
        throw new Error("Agora SDK not loaded");
    }

    options.channel = channelName;

    rtc.client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

    // Handle remote user join
    rtc.client.on("user-published", async (user, mediaType) => {
        await rtc.client.subscribe(user, mediaType);
        
        if (mediaType === "video") {
            // Get or create container for remote video
            const remoteVideoTrack = user.videoTrack;
            if (onRemoteUserJoined) {
                onRemoteUserJoined(user, remoteVideoTrack);
            } else {
                const playerContainer = document.getElementById(remotePlayerContainerId);
                const player = document.createElement("div");
                player.id = user.uid.toString();
                player.style.width = "100%";
                player.style.height = "100%";
                playerContainer.append(player);
                remoteVideoTrack.play(player.id);
            }
        }

        if (mediaType === "audio") {
            const remoteAudioTrack = user.audioTrack;
            remoteAudioTrack.play();
        }
    });

    rtc.client.on("user-unpublished", user => {
        if (onRemoteUserLeft) {
            onRemoteUserLeft(user);
        } else {
            const playerContainer = document.getElementById(user.uid.toString());
            if (playerContainer) playerContainer.remove();
        }
    });

    try {
        // Join the channel
        options.uid = await rtc.client.join(options.appId, options.channel, options.token, null);

        // Create local tracks
        rtc.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        rtc.localVideoTrack = await AgoraRTC.createCameraVideoTrack();

        // Publish local tracks
        await rtc.client.publish([rtc.localAudioTrack, rtc.localVideoTrack]);

        // Play local video
        const localContainer = document.getElementById(localPlayerContainerId);
        if (localContainer) {
            localContainer.innerHTML = '';
            rtc.localVideoTrack.play(localPlayerContainerId);
        }
        
    } catch (e) {
        console.error("Agora Error", e);
        throw e;
    }
};

export const leaveCall = async () => {
    if (rtc.localAudioTrack) {
        rtc.localAudioTrack.close();
    }
    if (rtc.localVideoTrack) {
        rtc.localVideoTrack.close();
    }

    if (rtc.client) {
        // Remove remote users and leave channel
        rtc.client.remoteUsers.forEach(user => {
            const playerContainer = document.getElementById(user.uid.toString());
            if (playerContainer) playerContainer.remove();
        });
        await rtc.client.leave();
    }
};
