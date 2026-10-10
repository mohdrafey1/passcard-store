import { loginKey, parseImport } from '../import-formats';

const CATEGORIES = ['Personal', 'Work', 'Banking', 'Other'];

describe('parseImport', () => {
  it('reads Google Password Manager / Chrome', () => {
    const csv =
      'name,url,username,password,note\nGitHub,https://github.com/login,alexmorgan,s3cret!,\n,https://www.netflix.com/,alex@example.com,pw2,Family plan\n';
    const r = parseImport(csv, CATEGORIES);
    expect(r.format).toBe('google');
    expect(r.logins).toHaveLength(2);
    expect(r.logins[0]).toMatchObject({ title: 'GitHub', username: 'alexmorgan', password: 's3cret!' });
    expect(r.logins[1]).toMatchObject({ title: 'netflix.com', email: 'alex@example.com', username: '', notes: 'Family plan' });
  });

  it('reads Firefox and titles rows by host', () => {
    const csv =
      '"url","username","password","httpRealm","formActionOrigin","guid","timeCreated","timeLastUsed","timePasswordChanged"\n' +
      '"https://accounts.example.org","me","p","","https://accounts.example.org","{1}","1","2","3"\n';
    const r = parseImport(csv);
    expect(r.format).toBe('firefox');
    expect(r.logins[0]).toMatchObject({ title: 'accounts.example.org', username: 'me', password: 'p' });
  });

  it('reads Bitwarden, keeps favourites and folders, skips notes', () => {
    const csv =
      'folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp\n' +
      'Work,1,login,GitLab,,,0,https://gitlab.com,alex,pw,JBSWY3DPEHPK3PXP\n' +
      ',,note,Wi-Fi,the wifi code,,0,,,,\n';
    const r = parseImport(csv, CATEGORIES);
    expect(r.format).toBe('bitwarden');
    expect(r.skipped).toBe(1);
    expect(r.logins).toHaveLength(1);
    expect(r.logins[0]).toMatchObject({ title: 'GitLab', category: 'Work', favorite: true, username: 'alex' });
    expect(r.logins[0].notes).toContain('JBSWY3DPEHPK3PXP');
  });

  it('reads LastPass and skips secure notes', () => {
    const csv =
      'url,username,password,totp,extra,name,grouping,fav\n' +
      'https://amazon.in,alex,pw,,,Amazon,Shopping,0\n' +
      'http://sn,,,,Passport no 123,Passport,,0\n';
    const r = parseImport(csv, CATEGORIES);
    expect(r.format).toBe('lastpass');
    expect(r.skipped).toBe(1);
    expect(r.logins[0]).toMatchObject({ title: 'Amazon', category: 'Other' });
  });

  it('reads 1Password 8', () => {
    const csv = 'Title,Url,Username,Password,OTPAuth,Favorite,Archived,Tags,Notes\nIRCTC,https://irctc.co.in,alexm_92,pw,,true,false,,\n';
    const r = parseImport(csv);
    expect(r.format).toBe('onepassword');
    expect(r.logins[0]).toMatchObject({ title: 'IRCTC', favorite: true });
  });

  it('reads KeePassXC and KeePass 2', () => {
    const xc =
      '"Group","Title","Username","Password","URL","Notes","TOTP","Icon","Last Modified","Created"\n"Root/Banking","HDFC","4471","pw","https://hdfc.com","","","0","",""\n';
    expect(parseImport(xc).format).toBe('keepassxc');
    const kp = '"Account","Login Name","Password","Web Site","Comments"\n"Spotify","alex","pw","https://spotify.com","music"\n';
    const r = parseImport(kp);
    expect(r.format).toBe('keepass');
    expect(r.logins[0]).toMatchObject({ title: 'Spotify', username: 'alex', website: 'https://spotify.com', notes: 'music' });
  });

  it('reads this app’s own export, including categories', () => {
    const csv = 'title,website,username,email,password,notes,category\nGitHub,github.com,alex,,pw,,Work\n';
    const r = parseImport(csv, CATEGORIES);
    expect(r.format).toBe('passcard');
    expect(r.logins[0].category).toBe('Work');
  });

  it('reads this app’s card export', () => {
    const csv = 'cardNickname,cardHolderName,cardNumber,expiryMonth,expiryYear,cvv,notes\nRegalia,ALEX,4111 1111 1111 1111,8,2029,284,\n';
    const r = parseImport(csv);
    expect(r.format).toBe('passcard-cards');
    expect(r.cards[0]).toMatchObject({ cardNumber: '4111111111111111', expiryMonth: '08', expiryYear: '29' });
  });

  it('matches generic columns by name', () => {
    const csv = 'Site,Login,Pass,Comment\nPaytm,alex,pw,hi\n';
    const r = parseImport(csv);
    expect(r.format).toBe('generic');
    expect(r.logins[0]).toMatchObject({ title: 'Paytm', username: 'alex', password: 'pw', notes: 'hi' });
  });

  it('reports rows without a password instead of silently dropping them', () => {
    const r = parseImport('name,url,username,password,note\nEmpty,https://x.com,me,,\n');
    expect(r.logins).toHaveLength(0);
    expect(r.problems).toEqual([{ row: 1, message: 'No password for Empty; skipped.' }]);
  });

  it('explains a file with no password column', () => {
    const r = parseImport('a,b\n1,2\n');
    expect(r.problems[0].message).toMatch(/No password column/);
  });

  it('copes with a byte-order mark and quoted commas', () => {
    const r = parseImport('﻿name,url,username,password,note\n"Bank, Inc",https://bank.com,me,"p,w",\n');
    expect(r.logins[0]).toMatchObject({ title: 'Bank, Inc', password: 'p,w' });
  });
});

describe('loginKey', () => {
  it('ignores case in names but not in passwords', () => {
    const a = { title: 'GitHub', username: 'Alex', email: '', password: 'Pw' };
    expect(loginKey(a)).toBe(loginKey({ ...a, title: 'github', username: 'alex' }));
    expect(loginKey(a)).not.toBe(loginKey({ ...a, password: 'pw' }));
  });
});
