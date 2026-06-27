import React, { useState, useEffect, useMemo } from 'react';

interface HexEditorProps {
  data: Uint8Array;
  onChange?: (data: Uint8Array) => void;
}

export const HexEditor: React.FC<HexEditorProps> = ({ data, onChange }) => {
  const [hexData, setHexData] = useState<Uint8Array>(data);
  const [offset, setOffset] = useState(0);
  const rows = 16;
  const bytesPerRow = 16;

  useEffect(() => {
    setHexData(data);
  }, [data]);

  const totalRows = Math.ceil(hexData.length / bytesPerRow);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const rowHeight = 24;
    const newOffset = Math.floor(e.currentTarget.scrollTop / rowHeight) * bytesPerRow;
    setOffset(Math.max(0, Math.min(newOffset, hexData.length - rows * bytesPerRow)));
  };

  const handleByteChange = (index: number, val: string) => {
    const newByte = parseInt(val, 16);
    if (!isNaN(newByte) && newByte >= 0 && newByte <= 255) {
      const newData = new Uint8Array(hexData);
      newData[index] = newByte;
      setHexData(newData);
      if (onChange) onChange(newData);
    }
  };

  const visibleBytes = useMemo(() => {
    const start = offset;
    const end = Math.min(start + rows * bytesPerRow, hexData.length);
    return hexData.slice(start, end);
  }, [hexData, offset]);

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-xs p-4 overflow-hidden relative">
      <div className="flex mb-2 text-[#569cd6] font-bold">
        <div className="w-20">Offset</div>
        <div className="flex-1 flex">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="w-6 text-center">{i.toString(16).padStart(2, '0').toUpperCase()}</div>
          ))}
        </div>
        <div className="w-48 ml-4">Decoded Text</div>
      </div>
      <div 
        className="flex-1 overflow-y-auto" 
        onScroll={handleScroll}
      >
        <div style={{ height: `${totalRows * 24}px`, position: 'relative' }}>
          <div style={{ position: 'absolute', top: `${Math.floor(offset / bytesPerRow) * 24}px`, left: 0, right: 0 }}>
            {Array.from({ length: Math.ceil(visibleBytes.length / bytesPerRow) }).map((_, rowIndex) => {
              const rowOffset = offset + rowIndex * bytesPerRow;
              const rowBytes = visibleBytes.slice(rowIndex * bytesPerRow, (rowIndex + 1) * bytesPerRow);
              
              return (
                <div key={rowOffset} className="flex h-[24px] items-center hover:bg-[#2a2d2e]">
                  <div className="w-20 text-[#858585] select-none">
                    {rowOffset.toString(16).padStart(8, '0').toUpperCase()}
                  </div>
                  <div className="flex-1 flex gap-1">
                    {Array.from(rowBytes).map((byte, colIndex) => (
                      <input
                        key={colIndex}
                        type="text"
                        maxLength={2}
                        className="w-5 text-center bg-transparent focus:bg-[#062f4a] focus:text-white outline-none"
                        value={byte.toString(16).padStart(2, '0').toUpperCase()}
                        onChange={(e) => handleByteChange(rowOffset + colIndex, e.target.value)}
                      />
                    ))}
                  </div>
                  <div className="w-48 ml-4 text-[#ce9178] select-none break-all whitespace-nowrap overflow-hidden">
                    {Array.from(rowBytes).map((byte, i) => {
                      const char = String.fromCharCode(byte);
                      // printable ascii
                      return (byte >= 32 && byte <= 126) ? char : '.';
                    }).join('')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
