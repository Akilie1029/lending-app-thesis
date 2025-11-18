import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/Feather";
import { useNavigation } from "@react-navigation/native";

export default function SmallHeader({ title }: { title: string }) {
  const navigation = useNavigation();

  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Icon name="arrow-left" size={26} color="#fff" />
      </TouchableOpacity>

      <Text style={styles.title}>{title}</Text>

      {/* Placeholder for spacing */}
      <View style={{ width: 26 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 55,
    backgroundColor: "#00a6ff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginRight: 26, // keeps title centered
  },
});
