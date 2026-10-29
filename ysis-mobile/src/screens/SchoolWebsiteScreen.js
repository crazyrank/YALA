import React from 'react';
import WebPageScreen from './WebPageScreen';

const SCHOOL_WEBSITE = {
  title: 'Yalamatrix Schools',
  subtitle: 'Official School Website',
  url: 'https://www.yalamatrixschools.com',
  allowedHosts: ['yalamatrixschools.com'],
};

export default function SchoolWebsiteScreen({ navigation }) {
  return <WebPageScreen navigation={navigation} route={{ params: SCHOOL_WEBSITE }} />;
}
