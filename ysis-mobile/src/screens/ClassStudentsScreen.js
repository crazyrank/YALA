import React from 'react';
import StudentsListScreen from './StudentsListScreen';

export default function ClassStudentsScreen({ navigation, route }) {
  return (
    <StudentsListScreen
      navigation={navigation}
      route={{
        ...route,
        params: {
          ...(route?.params || {}),
          classLevel: route?.params?.classLevel || '',
        },
      }}
    />
  );
}
