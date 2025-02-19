import React, { useEffect, useRef, useState } from 'react';
import ReactPlayer from 'react-player';
import { init, setFocus, getFocusKey, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { TVPlayer as BaseTVPlayer } from 'react-tv-player';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClosedCaptioning, faVolumeUp, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import './styles.scss';

// Extended types for our custom implementation
interface SubtitleTrack {
  id: string;
  language: string;
  url: string;
}

interface AudioTrack {
  id: string;
  language: string;
  name: string;
}

interface EPGData {
  startTime: string;
  endTime: string;
  title: string;
  description: string;
}

interface ExtendedTVPlayerProps {
  subtitles?: SubtitleTrack[];
  audioTracks?: AudioTrack[];
  epgData?: EPGData;
  onSubtitleChange?: (track: SubtitleTrack | null) => void;
  onAudioTrackChange?: (track: AudioTrack) => void;
  isLiveStream?: boolean;
}

export const TVPlayer: React.FC<ExtendedTVPlayerProps> = ({
  subtitles = [],
  audioTracks = [],
  epgData,
  onSubtitleChange,
  onAudioTrackChange,
  isLiveStream = false,
  ...props
}) => {
  const [currentSubtitle, setCurrentSubtitle] = useState<SubtitleTrack | null>(null);
  const [currentAudioTrack, setCurrentAudioTrack] = useState<AudioTrack | null>(null);
  const [showEPG, setShowEPG] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [showAudioTracks, setShowAudioTracks] = useState(false);
  const playerRef = useRef<ReactPlayer>(null);

  // Set up focusable container for spatial navigation
  const { ref: navigationRef } = useFocusable({
    focusKey: 'player-container',
    trackChildren: true,
    onBackPress: () => {
      closeAllOverlays();
      return true;
    },
  });

  // Initialize spatial navigation
  useEffect(() => {
    init({
      debug: false,
      visualDebug: false,
      throttle: 0, // Disable throttling for smoother navigation
    });
    
    // Set initial focus to player controls
    setFocus('player-controls');

    // Handle keyboard/remote events
    const handleKeyDown = (event: KeyboardEvent) => {
      const currentFocus = getFocusKey();
      
      switch (event.key) {
        case 'Escape':
        case 'BackSpace': // For TV remote back button
          closeAllOverlays();
          break;
        case 'Enter':
          if (currentFocus?.startsWith('subtitle-')) {
            const trackId = currentFocus.replace('subtitle-', '');
            const track = subtitles.find(s => s.id === trackId);
            if (track) handleSubtitleChange(track);
          } else if (currentFocus?.startsWith('audio-')) {
            const trackId = currentFocus.replace('audio-', '');
            const track = audioTracks.find(a => a.id === trackId);
            if (track) handleAudioTrackChange(track);
          }
          break;
        case 'ArrowUp':
        case 'ArrowDown':
          // Handle vertical navigation within overlays
          if (showSubtitles || showAudioTracks) {
            event.preventDefault(); // Prevent default scroll
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [subtitles, audioTracks, showSubtitles, showAudioTracks]);

  // Close all overlays
  const closeAllOverlays = () => {
    setShowSubtitles(false);
    setShowAudioTracks(false);
    setShowEPG(false);
    setFocus('player-controls');
  };

  // Handle subtitle change
  const handleSubtitleChange = (track: SubtitleTrack | null) => {
    setCurrentSubtitle(track);
    if (onSubtitleChange) {
      onSubtitleChange(track);
    }
    closeAllOverlays();
  };

  // Handle audio track change
  const handleAudioTrackChange = (track: AudioTrack) => {
    setCurrentAudioTrack(track);
    if (onAudioTrackChange) {
      onAudioTrackChange(track);
    }
    closeAllOverlays();
  };

  // Toggle overlays with focus management
  const toggleSubtitles = () => {
    const willShow = !showSubtitles;
    setShowSubtitles(willShow);
    setShowAudioTracks(false);
    setShowEPG(false);
    if (willShow) {
      setTimeout(() => setFocus('subtitle-list'), 100); // Delay focus until overlay is visible
    }
  };

  const toggleAudioTracks = () => {
    const willShow = !showAudioTracks;
    setShowAudioTracks(willShow);
    setShowSubtitles(false);
    setShowEPG(false);
    if (willShow) {
      setTimeout(() => setFocus('audio-list'), 100);
    }
  };

  const toggleEPG = () => {
    const willShow = !showEPG;
    setShowEPG(willShow);
    setShowSubtitles(false);
    setShowAudioTracks(false);
    if (willShow) {
      setTimeout(() => setFocus('epg-content'), 100);
    }
  };

  // Custom control buttons with focus keys
  const customButtons = [
    {
      action: 'subtitle',
      label: 'Subtitles',
      icon: <FontAwesomeIcon icon={faClosedCaptioning} />,
      onPress: toggleSubtitles,
      focusKey: 'subtitle-button',
      className: showSubtitles ? 'active' : '',
    },
    {
      action: 'audio',
      label: 'Audio',
      icon: <FontAwesomeIcon icon={faVolumeUp} />,
      onPress: toggleAudioTracks,
      focusKey: 'audio-button',
      className: showAudioTracks ? 'active' : '',
    },
    ...(isLiveStream
      ? [
          {
            action: 'epg',
            label: 'EPG',
            icon: <FontAwesomeIcon icon={faInfoCircle} />,
            onPress: toggleEPG,
            focusKey: 'epg-button',
            className: showEPG ? 'active' : '',
          },
        ]
      : []),
  ];

  return (
    <div ref={navigationRef} className="custom-tv-player">
      <BaseTVPlayer
        ref={playerRef}
        customButtons={customButtons}
        {...props}
      />
      
      {/* Subtitle selection overlay */}
      <div 
        className={`subtitle-overlay ${showSubtitles ? 'visible' : ''}`}
        data-focus-group="subtitle-menu"
      >
        <div className="menu-title">Subtitles</div>
        {subtitles.map((track) => (
          <button
            key={track.id}
            onClick={() => handleSubtitleChange(track)}
            className={currentSubtitle?.id === track.id ? 'active' : ''}
            data-focusable={true}
            data-focus-key={`subtitle-${track.id}`}
            data-focus-group="subtitle-menu"
          >
            {track.language}
          </button>
        ))}
        <button
          onClick={() => handleSubtitleChange(null)}
          className={!currentSubtitle ? 'active' : ''}
          data-focusable={true}
          data-focus-key="subtitle-off"
          data-focus-group="subtitle-menu"
        >
          Off
        </button>
      </div>

      {/* Audio track selection overlay */}
      <div 
        className={`audio-track-overlay ${showAudioTracks ? 'visible' : ''}`}
        data-focus-group="audio-menu"
      >
        <div className="menu-title">Audio Track</div>
        {audioTracks.map((track) => (
          <button
            key={track.id}
            onClick={() => handleAudioTrackChange(track)}
            className={currentAudioTrack?.id === track.id ? 'active' : ''}
            data-focusable={true}
            data-focus-key={`audio-${track.id}`}
            data-focus-group="audio-menu"
          >
            {track.name} ({track.language})
          </button>
        ))}
      </div>

      {/* EPG overlay for live streams */}
      {isLiveStream && epgData && (
        <div 
          className={`epg-overlay ${showEPG ? 'visible' : ''}`}
          data-focusable={true}
          data-focus-key="epg-content"
          data-focus-group="epg"
        >
          <div className="epg-content">
            <h3>{epgData.title}</h3>
            <p>{epgData.startTime} - {epgData.endTime}</p>
            <p>{epgData.description}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TVPlayer;