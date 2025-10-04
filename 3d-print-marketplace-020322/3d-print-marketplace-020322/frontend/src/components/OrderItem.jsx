useEffect(() => {
  const fetchUser = async () => {
    const response = await fetch(`/api/users/${userId}`);
    const data = await response.json();
    setUser(data);
    // 确保头像URL包含完整路径
    if (data.avatar && !data.avatar.startsWith('http')) {
      setAvatarUrl(`${process.env.REACT_APP_API_URL}${data.avatar}`);
    } else {
      setAvatarUrl(data.avatar);
    }
  };
  fetchUser();
}, [userId]);