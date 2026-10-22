/**
 * A video file's date (documentation/gallery/spec.md §3.8, V50): `creation_time` read from an MP4 or MOV's
 * `mvhd` box, or a WebM's `DateUTC`, on tiny made-up files.
 */
import { describe, expect, it } from 'vitest';
import { videoTakenOf } from '../../src/site/editor/model/videoDate';

const MAC_EPOCH = 2082844800n;
const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
};
const box = (type: string, body: Buffer) => Buffer.concat([u32(8 + body.length), Buffer.from(type, 'latin1'), body]);
const ftyp = box('ftyp', Buffer.from('isom\0\0\0\0isom', 'latin1'));
const mvhd0 = (unix: number) => box('mvhd', Buffer.concat([Buffer.from([0, 0, 0, 0]), u32(Number(BigInt(unix) + MAC_EPOCH)), u32(0), Buffer.alloc(88)]));
const mvhd1 = (unix: number) => {
  const t = Buffer.alloc(8);
  t.writeBigUInt64BE(BigInt(unix) + MAC_EPOCH);
  return box('mvhd', Buffer.concat([Buffer.from([1, 0, 0, 0]), t, Buffer.alloc(8), Buffer.alloc(100)]));
};
const unixOf = (iso: string) => Date.parse(`${iso}T12:34:56Z`) / 1000;

// EBML: an ID as its own bytes, a size as a one-byte vint (0x80 | n) for small elements
const el = (id: number[], body: Buffer) => {
  if (body.length > 126) throw new Error('keep it small');
  return Buffer.concat([Buffer.from(id), Buffer.from([0x80 | body.length]), body]);
};
const dateUtc = (iso: string) => {
  const b = Buffer.alloc(8);
  b.writeBigInt64BE(BigInt(Date.parse(`${iso}T08:00:00Z`) - Date.parse('2001-01-01T00:00:00Z')) * 1_000_000n);
  return el([0x44, 0x61], b);
};
const ebmlHead = el([0x1a, 0x45, 0xdf, 0xa3], el([0x42, 0x82], Buffer.from('webm')));
const webm = (info: Buffer, unknownSize = false) => {
  const segBody = Buffer.concat([el([0x11, 0x4d, 0x9b, 0x74], Buffer.alloc(4)), el([0x15, 0x49, 0xa9, 0x66], info)]);
  const segment = unknownSize ? Buffer.concat([Buffer.from([0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]), segBody]) : Buffer.concat([Buffer.from([0x18, 0x53, 0x80, 0x67, 0x40 | (segBody.length >> 8), segBody.length & 0xff]), segBody]);
  return Buffer.concat([ebmlHead, segment]);
};

describe("a video file's date", () => {
  it("reads an MP4's or MOV's creation time from its mvhd (version 0 and 1), as a day in UTC", () => {
    expect(videoTakenOf(Buffer.concat([ftyp, box('moov', mvhd0(unixOf('2021-07-14')))]))).toBe('2021-07-14');
    expect(videoTakenOf(Buffer.concat([ftyp, box('free', Buffer.alloc(16)), box('moov', Buffer.concat([mvhd1(unixOf('2019-02-03')), box('trak', Buffer.alloc(8))]))]))).toBe('2019-02-03');
  });

  it('follows a 64-bit box size and finds the moov after the media data', () => {
    const mdat = Buffer.concat([u32(1), Buffer.from('mdat'), Buffer.alloc(8), Buffer.alloc(32)]);
    mdat.writeBigUInt64BE(BigInt(mdat.length), 8);
    expect(videoTakenOf(Buffer.concat([ftyp, mdat, box('moov', mvhd0(unixOf('2024-12-31')))]))).toBe('2024-12-31');
  });

  it("gives nothing for a time that was never set (zero, or before 1971), no moov, a cut file or what isn't a video", () => {
    expect(videoTakenOf(Buffer.concat([ftyp, box('moov', box('mvhd', Buffer.alloc(100)))]))).toBeUndefined();
    expect(videoTakenOf(Buffer.concat([ftyp, box('moov', mvhd0(unixOf('1970-06-01')))]))).toBeUndefined();
    expect(videoTakenOf(ftyp)).toBeUndefined();
    expect(videoTakenOf(Buffer.concat([ftyp, box('moov', mvhd0(unixOf('2021-07-14')))]).subarray(0, 40))).toBeUndefined();
    expect(videoTakenOf(Buffer.from('not a video at all'))).toBeUndefined();
    expect(videoTakenOf(new Uint8Array(0))).toBeUndefined();
    expect(videoTakenOf(Buffer.from('1a45dfa3', 'hex'))).toBeUndefined();
  });

  it("reads a WebM's DateUTC from its Segment's Info, with a known or an unknown size", () => {
    const info = Buffer.concat([el([0x2a, 0xd7, 0xb1], Buffer.from([0x0f, 0x42, 0x40])), dateUtc('2023-03-04')]);
    expect(videoTakenOf(webm(info))).toBe('2023-03-04');
    expect(videoTakenOf(webm(info, true))).toBe('2023-03-04');
    expect(videoTakenOf(webm(el([0x2a, 0xd7, 0xb1], Buffer.from([0x0f, 0x42, 0x40]))))).toBeUndefined();
  });
});
