// dev-identity và route `_ip` chỉ mở khi NODE_ENV=test — không để NODE_ENV của shell quyết định
process.env.NODE_ENV = 'test';
