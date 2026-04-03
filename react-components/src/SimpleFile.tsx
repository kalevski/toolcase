import React from 'react';

export interface SimpleFileProps {
  name: string;
  extension: string;
  format?: 'unknown' | 'image' | 'audio' | 'binary';
}

export const SimpleFile: React.FC<SimpleFileProps> = ({ name, extension, format = 'unknown' }) => (
  <div className="component component-simple-file">
    <div className={`component-simple-file__type file-bg--${format}`}>
      <span>{extension}</span>
    </div>
    <div className="component-simple-file__label">
      <span>{name}</span>
    </div>
  </div>
);

export default SimpleFile;
